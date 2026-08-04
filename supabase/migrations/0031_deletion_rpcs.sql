-- ============================================================================
-- 0031 - deleting a take or a work, and account deletion catching up with v2
--
-- Design: docs/schema-v2.md §14.3 §15
--
-- takes and works have no DELETE policy. Removing one has to do four things in
-- one transaction, and doing them as separate client queries leaves the two
-- failure modes we cannot repair afterwards: rows gone but objects still in R2,
-- or materials orphaned with no parent.
--
--   1. authorise at the admin rung
--   2. refuse while a live publication points at the take
--   3. decide what happens to materials that exist nowhere else
--   4. queue only the R2 keys whose reference count reaches zero
--
-- Unlike the account-deletion RPCs (service_role only, because they take the
-- target user as an argument), these are callable by `authenticated`: they take
-- only an object id and derive the actor from auth.uid(), so there is nothing
-- to forge.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- generic R2 cleanup completion ----------------------------------

-- 0013 shipped this as complete_account_r2_cleanup. Take deletion needs exactly
-- the same bookkeeping, so the implementation moves to a neutral name and the
-- account-shaped name delegates (existing callers keep working).
create or replace function public.complete_r2_cleanup(
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

create or replace function public.complete_account_r2_cleanup(
  p_deletion_id uuid,
  p_failed_keys text[],
  p_error text default null
)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.complete_r2_cleanup(p_deletion_id, p_failed_keys, p_error);
$$;

revoke all on function public.complete_r2_cleanup(uuid, text[], text)
  from public, anon, authenticated;
grant execute on function public.complete_r2_cleanup(uuid, text[], text)
  to service_role;

-- ---------- delete one take -------------------------------------------------

create or replace function public.delete_take(
  p_take_id uuid,
  p_material_disposition text default 'require_decision'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid;
  target_work_id uuid;
  deletion_id uuid := gen_random_uuid();
  at_risk jsonb := '[]'::jsonb;
  object_keys text[] := '{}'::text[];
begin
  if p_material_disposition not in ('require_decision','promote','discard') then
    raise exception 'INVALID_MATERIAL_DISPOSITION' using errcode = '22023';
  end if;

  select brand_id, work_id into target_brand_id, target_work_id
  from public.takes where id = p_take_id;
  if target_brand_id is null then
    raise exception 'TAKE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.can_admin_brand(target_brand_id) then
    raise exception 'TAKE_DELETE_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.publications publication
    join public.take_renders render on render.id = publication.render_id
    where render.take_id = p_take_id and publication.status = 'live'
  ) then
    raise exception 'TAKE_DELETE_BLOCKED_PUBLISHED' using errcode = '23514';
  end if;

  -- Material a person supplied: an upload, a fetched file, a paid generation.
  -- Losing it is not recoverable by re-running anything, so it needs a decision.
  select coalesce(
    jsonb_agg(jsonb_build_object('id', material.id, 'label', material.label,
                                 'kind', material.kind) order by material.created_at),
    '[]'::jsonb
  )
  into at_risk
  from public.brand_materials material
  where material.take_id = p_take_id
    and material.scope = 'take'
    and material.source_kind in ('upload','url_fetch','ai_generated');

  if jsonb_array_length(at_risk) > 0 then
    if p_material_disposition = 'require_decision' then
      raise exception 'TAKE_DELETE_NEEDS_MATERIAL_DECISION'
        using errcode = '23514', detail = at_risk::text;
    elsif p_material_disposition = 'promote' then
      update public.brand_materials
      set scope = case when target_work_id is null then 'brand' else 'work' end,
          work_id = target_work_id,
          updated_at = now()
      where take_id = p_take_id
        and scope = 'take'
        and source_kind in ('upload','url_fetch','ai_generated');
      -- the promotion trigger clears take_id and stamps promoted_at/by
    end if;
  end if;

  -- Only now, after promotion may have rescued rows, is the doomed key set
  -- final. A key still referenced from outside this take must not be queued:
  -- a promoted material and its origin artifact share one object.
  with doomed as (
    select material.r2_key as object_key
    from public.brand_materials material
    where material.take_id = p_take_id and material.r2_key is not null
    union
    select artifact.r2_key
    from public.render_artifacts artifact
    join public.take_renders render on render.id = artifact.render_id
    where render.take_id = p_take_id
  )
  select coalesce(array_agg(distinct doomed.object_key), '{}'::text[])
  into object_keys
  from doomed
  where doomed.object_key is not null
    and doomed.object_key <> ''
    and not exists (
      select 1 from public.brand_materials survivor
      where survivor.r2_key = doomed.object_key
        and survivor.take_id is distinct from p_take_id
    );

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select deletion_id, object_key, auth.uid()
  from unnest(object_keys) as object_key
  on conflict do nothing;

  -- Cascades take_runs, take_renders, render_artifacts, take_inputs and every
  -- material still scoped to this take.
  delete from public.takes where id = p_take_id;

  return jsonb_build_object(
    'deletionId', deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'promotedMaterials',
      case when p_material_disposition = 'promote' then at_risk else '[]'::jsonb end
  );
end;
$$;

-- ---------- delete one work -------------------------------------------------

create or replace function public.delete_work(
  p_work_id uuid,
  p_material_disposition text default 'require_decision'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_brand_id uuid;
  deletion_id uuid := gen_random_uuid();
  at_risk jsonb := '[]'::jsonb;
  object_keys text[] := '{}'::text[];
begin
  if p_material_disposition not in ('require_decision','promote','discard') then
    raise exception 'INVALID_MATERIAL_DISPOSITION' using errcode = '22023';
  end if;

  select brand_id into target_brand_id from public.works where id = p_work_id;
  if target_brand_id is null then
    raise exception 'WORK_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.can_admin_brand(target_brand_id) then
    raise exception 'WORK_DELETE_FORBIDDEN' using errcode = '42501';
  end if;

  -- Takes survive a deleted work (takes.work_id is ON DELETE SET NULL), so only
  -- the work-scoped materials are at stake.
  select coalesce(
    jsonb_agg(jsonb_build_object('id', material.id, 'label', material.label,
                                 'kind', material.kind) order by material.created_at),
    '[]'::jsonb
  )
  into at_risk
  from public.brand_materials material
  where material.work_id = p_work_id
    and material.scope = 'work'
    and material.source_kind in ('upload','url_fetch','ai_generated');

  if jsonb_array_length(at_risk) > 0 then
    if p_material_disposition = 'require_decision' then
      raise exception 'WORK_DELETE_NEEDS_MATERIAL_DECISION'
        using errcode = '23514', detail = at_risk::text;
    elsif p_material_disposition = 'promote' then
      update public.brand_materials
      set scope = 'brand', updated_at = now()
      where work_id = p_work_id
        and scope = 'work'
        and source_kind in ('upload','url_fetch','ai_generated');
    end if;
  end if;

  select coalesce(array_agg(distinct material.r2_key), '{}'::text[])
  into object_keys
  from public.brand_materials material
  where material.work_id = p_work_id
    and material.r2_key is not null
    and material.r2_key <> ''
    and not exists (
      select 1 from public.brand_materials survivor
      where survivor.r2_key = material.r2_key
        and survivor.work_id is distinct from p_work_id
    )
    and not exists (
      select 1 from public.render_artifacts artifact
      where artifact.r2_key = material.r2_key
    );

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select deletion_id, object_key, auth.uid()
  from unnest(object_keys) as object_key
  on conflict do nothing;

  delete from public.works where id = p_work_id;

  return jsonb_build_object(
    'deletionId', deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'promotedMaterials',
      case when p_material_disposition = 'promote' then at_risk else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.delete_take(uuid, text) from public, anon;
revoke all on function public.delete_work(uuid, text) from public, anon;
grant execute on function public.delete_take(uuid, text) to authenticated, service_role;
grant execute on function public.delete_work(uuid, text) to authenticated, service_role;

comment on function public.delete_take(uuid, text) is
  'Deletes one take after checking the admin rung, refusing while published, and settling its materials. Returns the R2 keys the route must remove.';

-- ---------- account deletion catches up with v2 ----------------------------

-- Two reasons this cannot be left alone:
--   * brand_materials.r2_key and render_artifacts.r2_key were invisible to the
--     old key sweep, so leaving would silently keep personal files in R2
--   * takes/works/materials reference brand_entities with ON DELETE RESTRICT,
--     so the existing brand cleanup statement would now fail outright
create or replace function private.account_deleted_brand_ids(
  p_user_id uuid,
  p_deleted_org_ids uuid[]
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(entity.id), '{}'::uuid[])
  from public.brand_entities entity
  where entity.created_by = p_user_id
    and entity.linked_org_id is null
    and not exists (
      select 1
      from public.logos logo
      where logo.subject_entity_id = entity.id
        and not (
          logo.owner_user_id = p_user_id
          or logo.owner_org_id = any(p_deleted_org_ids)
        )
    );
$$;

revoke all on function private.account_deleted_brand_ids(uuid, uuid[])
  from public, anon, authenticated;

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
  deleted_brand_ids uuid[] := '{}'::uuid[];
  blockers jsonb := '[]'::jsonb;
  personal_logo_count integer := 0;
  deleted_org_logo_count integer := 0;
  retained_org_count integer := 0;
  take_count integer := 0;
  r2_object_count integer := 0;
begin
  select is_anonymous into account_is_anonymous
  from public.users where user_id = p_user_id;

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
      select 1 from public.org_members other
      where other.org_id = m.org_id and other.user_id <> p_user_id
    );

  select coalesce(
    jsonb_agg(jsonb_build_object('id', o.org_id, 'name', o.name) order by o.name, o.org_id),
    '[]'::jsonb
  )
  into blockers
  from public.org_members mine
  join public.organizations o on o.org_id = mine.org_id
  where mine.user_id = p_user_id
    and mine.role = 'owner'
    and not exists (
      select 1 from public.org_members other_owner
      where other_owner.org_id = mine.org_id
        and other_owner.user_id <> p_user_id
        and other_owner.role = 'owner'
    )
    and exists (
      select 1 from public.org_members other_member
      where other_member.org_id = mine.org_id
        and other_member.user_id <> p_user_id
    );

  deleted_brand_ids := private.account_deleted_brand_ids(p_user_id, deleted_org_ids);

  select count(*) into personal_logo_count
  from public.logos where owner_user_id = p_user_id;

  select count(*) into deleted_org_logo_count
  from public.logos where owner_org_id = any(deleted_org_ids);

  select count(*) into retained_org_count
  from public.org_members
  where user_id = p_user_id and not (org_id = any(deleted_org_ids));

  select count(*) into take_count
  from public.takes where brand_id = any(deleted_brand_ids);

  select count(*) into r2_object_count
  from (
    select m.image_path as object_key
    from public.logo_mockups m
    join public.logo_candidates c on c.id = m.candidate_id
    join public.logos l on l.id = c.logo_id
    where (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and m.image_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select r.output_path
    from public.logo_asset_runs r
    join public.logo_candidates c on c.id = r.candidate_id
    join public.logos l on l.id = c.logo_id
    where r.output_path is not null
      and (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and r.output_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select material.r2_key
    from public.brand_materials material
    where material.brand_id = any(deleted_brand_ids) and material.r2_key is not null
    union
    select artifact.r2_key
    from public.render_artifacts artifact
    join public.take_renders render on render.id = artifact.render_id
    join public.takes take on take.id = render.take_id
    where take.brand_id = any(deleted_brand_ids)
  ) paths
  where object_key is not null and object_key <> '';

  return jsonb_build_object(
    'personalLogoCount', personal_logo_count,
    'deletedOrganizationCount', cardinality(deleted_org_ids),
    'deletedOrganizationLogoCount', deleted_org_logo_count,
    'retainedOrganizationCount', retained_org_count,
    'deletedBrandCount', cardinality(deleted_brand_ids),
    'deletedTakeCount', take_count,
    'r2ObjectCount', r2_object_count,
    'blockingOrganizations', blockers
  );
end;
$$;

create or replace function public.delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview jsonb;
  deleted_org_ids uuid[] := '{}'::uuid[];
  deleted_brand_ids uuid[] := '{}'::uuid[];
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
      select 1 from public.org_members other
      where other.org_id = m.org_id and other.user_id <> p_user_id
    );

  deleted_brand_ids := private.account_deleted_brand_ids(p_user_id, deleted_org_ids);

  select coalesce(array_agg(object_key order by object_key), '{}'::text[])
  into object_keys
  from (
    select m.image_path as object_key
    from public.logo_mockups m
    join public.logo_candidates c on c.id = m.candidate_id
    join public.logos l on l.id = c.logo_id
    where (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and m.image_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select r.output_path
    from public.logo_asset_runs r
    join public.logo_candidates c on c.id = r.candidate_id
    join public.logos l on l.id = c.logo_id
    where r.output_path is not null
      and (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and r.output_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select material.r2_key
    from public.brand_materials material
    where material.brand_id = any(deleted_brand_ids) and material.r2_key is not null
    union
    select artifact.r2_key
    from public.render_artifacts artifact
    join public.take_renders render on render.id = artifact.render_id
    join public.takes take on take.id = render.take_id
    where take.brand_id = any(deleted_brand_ids)
  ) paths
  where object_key is not null and object_key <> '';

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select current_deletion_id, object_key, p_user_id
  from unnest(object_keys) as object_key
  on conflict do nothing;

  -- v2 rows first: takes and works hold the Brand with ON DELETE RESTRICT, so
  -- the brand cleanup below cannot run while they exist.
  delete from public.takes where brand_id = any(deleted_brand_ids);
  delete from public.works where brand_id = any(deleted_brand_ids);
  delete from public.brand_materials where brand_id = any(deleted_brand_ids);

  delete from public.logos where owner_user_id = p_user_id;
  delete from public.organizations where org_id = any(deleted_org_ids);

  delete from public.logo_transfer_requests
  where proposed_owner_user_id = p_user_id
     or source_owner_user_id = p_user_id;

  delete from public.brand_entities e
  where e.created_by = p_user_id
    and e.linked_org_id is null
    and not exists (
      select 1 from public.logos l where l.subject_entity_id = e.id
    );

  delete from public.users where user_id = p_user_id;
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'deletionId', current_deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'preview', preview
  );
end;
$$;

revoke all on function public.account_deletion_preview(uuid)
  from public, anon, authenticated;
revoke all on function public.delete_user_account(uuid)
  from public, anon, authenticated;
grant execute on function public.account_deletion_preview(uuid) to service_role;
grant execute on function public.delete_user_account(uuid) to service_role;

-- ---------- verification ---------------------------------------------------

select
  to_regprocedure('public.delete_take(uuid,text)') is not null as has_delete_take,
  to_regprocedure('public.delete_work(uuid,text)') is not null as has_delete_work,
  to_regprocedure('public.complete_r2_cleanup(uuid,text[],text)') is not null
    as has_generic_cleanup,
  has_function_privilege('authenticated', 'public.delete_take(uuid,text)', 'execute')
    as take_deletion_callable_by_owner,
  not has_function_privilege('authenticated', 'public.delete_user_account(uuid)', 'execute')
    as account_deletion_still_service_only;
