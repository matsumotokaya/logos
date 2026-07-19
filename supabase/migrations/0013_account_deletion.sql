-- 0013_account_deletion.sql
-- Registered-account deletion and organization-owner safeguards.
--
-- Deletion policy:
--   * personal logos and every dependent presentation/candidate/mockup/run row
--     are deleted
--   * organization-owned logos stay with the organization
--   * a sole-member organization is deleted with its organization-owned data
--   * deletion is blocked when the user is the last owner of an organization
--     that still has other members; another member must be promoted first
--   * R2 keys are queued transactionally, then removed by the server route
--
-- Public RPCs below are callable only with the server-side service role. The
-- route must authenticate the end user and pass only that verified user id.
-- Idempotent when migrations are run in numeric order.

-- ---------- organization owner integrity ----------------------------------

create or replace function private.enforce_org_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  creator_bootstrap boolean := false;
begin
  if tg_op = 'DELETE' then
    target_org_id := old.org_id;
  else
    target_org_id := new.org_id;
  end if;

  -- Server-side account deletion and organization deletion have their own
  -- integrity checks and must be able to cascade memberships.
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.role = 'owner' then
    select
      not exists (
        select 1 from public.org_members m where m.org_id = new.org_id
      )
      and exists (
        select 1
        from public.organizations o
        where o.org_id = new.org_id and o.created_by = auth.uid()
      )
    into creator_bootstrap;

    if not creator_bootstrap
       and not private.has_org_role(
         new.org_id,
         array['owner']::public.org_role[]
       ) then
      raise exception 'Only an organization owner can assign the owner role.'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE'
        and (old.role = 'owner' or new.role = 'owner')
        and not private.has_org_role(
          target_org_id,
          array['owner']::public.org_role[]
        ) then
    raise exception 'Only an organization owner can change the owner role.'
      using errcode = '42501';
  elsif tg_op = 'DELETE'
        and old.role = 'owner'
        and not private.has_org_role(
          target_org_id,
          array['owner']::public.org_role[]
        ) then
    raise exception 'Only an organization owner can remove an owner.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE'
     and old.role = 'owner'
     and not exists (
       select 1
       from public.org_members m
       where m.org_id = target_org_id
         and m.role = 'owner'
         and m.user_id <> old.user_id
     ) then
    raise exception 'An organization must keep at least one owner.'
      using errcode = '23514';
  elsif tg_op = 'UPDATE'
        and old.role = 'owner'
        and new.role <> 'owner'
        and not exists (
          select 1
          from public.org_members m
          where m.org_id = target_org_id
            and m.role = 'owner'
            and m.user_id <> old.user_id
        ) then
    raise exception 'An organization must keep at least one owner.'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists org_members_owner_integrity on public.org_members;
create trigger org_members_owner_integrity
  before insert or update of role or delete on public.org_members
  for each row execute function private.enforce_org_owner_role();

-- ---------- R2 deletion outbox --------------------------------------------

create table if not exists private.r2_deletion_queue (
  deletion_id uuid not null,
  object_key text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  last_error text,
  primary key (deletion_id, object_key)
);

revoke all on table private.r2_deletion_queue from public, anon, authenticated;

-- ---------- preview --------------------------------------------------------

create or replace function public.account_deletion_preview(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_is_anonymous boolean;
  deleted_org_ids uuid[] := '{}'::uuid[];
  blockers jsonb := '[]'::jsonb;
  personal_logo_count integer := 0;
  deleted_org_logo_count integer := 0;
  retained_org_count integer := 0;
  r2_object_count integer := 0;
begin
  select is_anonymous
  into account_is_anonymous
  from public.users
  where user_id = p_user_id;

  if account_is_anonymous is null then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if account_is_anonymous then
    raise exception 'REGISTERED_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.org_id), '{}'::uuid[])
  into deleted_org_ids
  from public.org_members m
  where m.user_id = p_user_id
    and not exists (
      select 1
      from public.org_members other
      where other.org_id = m.org_id and other.user_id <> p_user_id
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', o.org_id, 'name', o.name)
      order by o.name, o.org_id
    ),
    '[]'::jsonb
  )
  into blockers
  from public.org_members mine
  join public.organizations o on o.org_id = mine.org_id
  where mine.user_id = p_user_id
    and mine.role = 'owner'
    and not exists (
      select 1
      from public.org_members other_owner
      where other_owner.org_id = mine.org_id
        and other_owner.user_id <> p_user_id
        and other_owner.role = 'owner'
    )
    and exists (
      select 1
      from public.org_members other_member
      where other_member.org_id = mine.org_id
        and other_member.user_id <> p_user_id
    );

  select count(*) into personal_logo_count
  from public.logos
  where owner_user_id = p_user_id;

  select count(*) into deleted_org_logo_count
  from public.logos
  where owner_org_id = any(deleted_org_ids);

  select count(*) into retained_org_count
  from public.org_members
  where user_id = p_user_id
    and not (org_id = any(deleted_org_ids));

  select count(*) into r2_object_count
  from (
    select m.image_path as object_key
    from public.logo_mockups m
    join public.logo_candidates c on c.id = m.candidate_id
    join public.logos l on l.id = c.logo_id
    where (
        l.owner_user_id = p_user_id
        or l.owner_org_id = any(deleted_org_ids)
      )
      and m.image_path like (
        'logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%'
      )
    union
    select r.output_path as object_key
    from public.logo_asset_runs r
    join public.logo_candidates c on c.id = r.candidate_id
    join public.logos l on l.id = c.logo_id
    where r.output_path is not null
      and (
        l.owner_user_id = p_user_id
        or l.owner_org_id = any(deleted_org_ids)
      )
      and r.output_path like (
        'logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%'
      )
  ) paths
  where object_key is not null and object_key <> '';

  return jsonb_build_object(
    'personalLogoCount', personal_logo_count,
    'deletedOrganizationCount', cardinality(deleted_org_ids),
    'deletedOrganizationLogoCount', deleted_org_logo_count,
    'retainedOrganizationCount', retained_org_count,
    'r2ObjectCount', r2_object_count,
    'blockingOrganizations', blockers
  );
end;
$$;

-- ---------- atomic DB/Auth deletion ---------------------------------------

create or replace function public.delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  deleted_org_ids uuid[] := '{}'::uuid[];
  object_keys text[] := '{}'::text[];
  current_deletion_id uuid := gen_random_uuid();
begin
  preview := public.account_deletion_preview(p_user_id);
  if jsonb_array_length(preview -> 'blockingOrganizations') > 0 then
    raise exception 'ACCOUNT_DELETE_BLOCKED_LAST_ORG_OWNER'
      using errcode = '23514', detail = (preview -> 'blockingOrganizations')::text;
  end if;

  select coalesce(array_agg(m.org_id), '{}'::uuid[])
  into deleted_org_ids
  from public.org_members m
  where m.user_id = p_user_id
    and not exists (
      select 1
      from public.org_members other
      where other.org_id = m.org_id and other.user_id <> p_user_id
    );

  select coalesce(array_agg(object_key order by object_key), '{}'::text[])
  into object_keys
  from (
    select m.image_path as object_key
    from public.logo_mockups m
    join public.logo_candidates c on c.id = m.candidate_id
    join public.logos l on l.id = c.logo_id
    where (
        l.owner_user_id = p_user_id
        or l.owner_org_id = any(deleted_org_ids)
      )
      and m.image_path like (
        'logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%'
      )
    union
    select r.output_path as object_key
    from public.logo_asset_runs r
    join public.logo_candidates c on c.id = r.candidate_id
    join public.logos l on l.id = c.logo_id
    where r.output_path is not null
      and (
        l.owner_user_id = p_user_id
        or l.owner_org_id = any(deleted_org_ids)
      )
      and r.output_path like (
        'logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%'
      )
  ) paths
  where object_key is not null and object_key <> '';

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select current_deletion_id, object_key, p_user_id
  from unnest(object_keys) as object_key;

  -- Delete logos explicitly before the user mirror so their subject entities
  -- can be cleaned up without losing the created_by relation first.
  delete from public.logos where owner_user_id = p_user_id;
  delete from public.organizations where org_id = any(deleted_org_ids);

  -- Ownership-transfer proposals targeting the deleted account cannot be
  -- SET NULL because their table check requires a target. Cancel them.
  delete from public.logo_transfer_requests
  where proposed_owner_user_id = p_user_id
     or source_owner_user_id = p_user_id;

  delete from public.brand_entities e
  where e.created_by = p_user_id
    and e.linked_org_id is null
    and not exists (
      select 1 from public.logos l where l.subject_entity_id = e.id
    );

  -- public.users cascades personal account data and memberships; organization
  -- records that remain keep their logos and audit rows with user refs nulled.
  delete from public.users where user_id = p_user_id;
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'deletionId', current_deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'preview', preview
  );
end;
$$;

create or replace function public.complete_account_r2_cleanup(
  p_deletion_id uuid,
  p_failed_keys text[],
  p_error text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_keys text[] := coalesce(p_failed_keys, '{}'::text[]);
  remaining integer;
begin
  delete from private.r2_deletion_queue
  where deletion_id = p_deletion_id
    and not (object_key = any(failed_keys));

  update private.r2_deletion_queue
  set last_error = left(coalesce(p_error, 'R2 deletion failed'), 1000)
  where deletion_id = p_deletion_id
    and object_key = any(failed_keys);

  select count(*) into remaining
  from private.r2_deletion_queue
  where deletion_id = p_deletion_id;
  return remaining;
end;
$$;

revoke all on function public.account_deletion_preview(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_user_account(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_account_r2_cleanup(uuid, text[], text)
  from public, anon, authenticated;

grant execute on function public.account_deletion_preview(uuid) to service_role;
grant execute on function public.delete_user_account(uuid) to service_role;
grant execute on function public.complete_account_r2_cleanup(uuid, text[], text)
  to service_role;

-- Verification: destructive RPCs must never be client-callable.
select
  has_function_privilege('service_role', 'public.delete_user_account(uuid)', 'execute')
    as service_can_delete,
  not has_function_privilege('anon', 'public.delete_user_account(uuid)', 'execute')
    as anon_cannot_delete,
  not has_function_privilege('authenticated', 'public.delete_user_account(uuid)', 'execute')
    as authenticated_cannot_delete;
