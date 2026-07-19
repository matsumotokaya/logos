-- 0012_security_advisor_hardening.sql
-- Security Advisor follow-up:
--   * keep SECURITY DEFINER helpers out of the Data API's exposed schema
--   * stop public enumeration of account email addresses
--   * resolve invitations without a client-side users lookup
--   * constrain global tag creation
--   * retire the unused public Supabase Storage mockups bucket
--
-- Anonymous Auth users still need to own/edit their uploaded logos, and public
-- / unlisted presentations still need anonymous reads. Those product-required
-- RLS paths intentionally remain available.
--
-- Idempotent when migrations are run in numeric order.

create schema if not exists private;
revoke all on schema private from public;

-- Existing projects granted EXECUTE on every new public function by default.
-- Make future public RPCs opt-in instead.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Move every internal SECURITY DEFINER function out of the exposed `public`
-- schema. ALTER ... SET SCHEMA preserves policy and trigger dependencies by
-- object id; the functions are re-declared below to update qualified calls.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'accept_pending_invites(text,uuid)',
    'can_admin_logo(text)',
    'can_edit_logo(text)',
    'can_manage_brand_entity(uuid)',
    'can_view_brand_entity(uuid)',
    'can_view_logo(text)',
    'can_view_logo_transfer_request(uuid)',
    'candidate_logo_id(uuid)',
    'enforce_visibility_admin()',
    'handle_auth_user_updated()',
    'handle_new_auth_user()',
    'handle_new_logo_candidate_lockup()',
    'handle_new_organization()',
    'has_org_role(uuid,public.org_role[])'
  ] loop
    if to_regprocedure('public.' || fn) is not null
       and to_regprocedure('private.' || fn) is null then
      execute format('alter function public.%s set schema private', fn);
    end if;
  end loop;
end;
$$;

create or replace function private.is_registered_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function private.has_org_role(
  p_org_id uuid,
  p_roles public.org_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org_id is not null and exists (
    select 1
    from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

create or replace function private.can_view_logo(p_logo_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.logos l
    where l.id = p_logo_id
      and (
        l.visibility in ('unlisted', 'public')
        or l.owner_user_id = auth.uid()
        or private.has_org_role(
          l.owner_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_edit_logo(p_logo_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.logos l
    where l.id = p_logo_id
      and (
        l.owner_user_id = auth.uid()
        or private.has_org_role(
          l.owner_org_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_admin_logo(p_logo_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.logos l
    where l.id = p_logo_id
      and (
        l.owner_user_id = auth.uid()
        or private.has_org_role(
          l.owner_org_id,
          array['owner','admin']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.candidate_logo_id(p_candidate_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select logo_id
  from public.logo_candidates
  where id = p_candidate_id;
$$;

create or replace function private.can_manage_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities e
    where e.id = p_entity_id
      and (
        e.created_by = auth.uid()
        or private.has_org_role(
          e.linked_org_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_view_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities e
    where e.id = p_entity_id
      and (
        e.created_by = auth.uid()
        or private.has_org_role(
          e.linked_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or exists (
          select 1
          from public.logos l
          where l.subject_entity_id = e.id
            and private.can_view_logo(l.id)
        )
      )
  );
$$;

create or replace function private.can_view_logo_transfer_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_request_id is not null and exists (
    select 1
    from public.logo_transfer_requests r
    where r.id = p_request_id
      and (
        r.requested_by = auth.uid()
        or r.source_owner_user_id = auth.uid()
        or r.proposed_owner_user_id = auth.uid()
        or private.has_org_role(
          r.source_owner_org_id,
          array['owner','admin']::public.org_role[]
        )
        or private.has_org_role(
          r.proposed_owner_org_id,
          array['owner','admin']::public.org_role[]
        )
        or private.can_admin_logo(r.logo_id)
      )
  );
$$;

create or replace function private.can_view_user_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
    or exists (
      select 1
      from public.org_members mine
      join public.org_members theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid()
        and theirs.user_id = p_user_id
    );
$$;

create or replace function private.accept_pending_invites(
  p_email text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or btrim(p_email) = '' or not exists (
    select 1
    from public.users
    where user_id = p_user_id and not is_anonymous
  ) then
    return;
  end if;

  insert into public.org_members (org_id, user_id, role)
  select i.org_id, p_user_id, i.role
  from public.org_invites i
  where lower(i.email) = lower(btrim(p_email))
  on conflict (org_id, user_id) do nothing;

  delete from public.org_invites
  where lower(email) = lower(btrim(p_email));
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (user_id, is_anonymous, contact_email)
  values (new.id, coalesce(new.is_anonymous, false), new.email)
  on conflict (user_id) do nothing;
  perform private.accept_pending_invites(new.email, new.id);
  return new;
end;
$$;

create or replace function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set is_anonymous = coalesce(new.is_anonymous, false),
      contact_email = new.email
  where user_id = new.id;
  perform private.accept_pending_invites(new.email, new.id);
  return new;
end;
$$;

create or replace function private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.org_members (org_id, user_id, role)
    values (new.org_id, new.created_by, 'owner')
    on conflict (org_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.handle_new_logo_candidate_lockup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.logo_lockups (
    candidate_id, kind, label, is_primary, sort_order
  ) values (
    new.id, 'primary', 'Primary', true, 0
  ) on conflict do nothing;
  return new;
end;
$$;

create or replace function private.enforce_visibility_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility
     and not private.can_admin_logo(old.id) then
    raise exception 'Only an owner or admin can change logo visibility.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Existing registered users are resolved inside the database, so the browser
-- no longer needs to query public.users by email.
create or replace function private.resolve_existing_org_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  select user_id into target_user_id
  from public.users
  where lower(contact_email) = lower(new.email)
    and not is_anonymous
  order by created_at
  limit 1;

  if target_user_id is not null then
    insert into public.org_members (org_id, user_id, role)
    values (new.org_id, target_user_id, new.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
    delete from public.org_invites where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_org_invite_resolve_existing on public.org_invites;
create trigger on_org_invite_resolve_existing
  after insert on public.org_invites
  for each row execute function private.resolve_existing_org_invite();

-- Internal trigger functions are not callable by API roles. RLS helpers are
-- executable only by the roles whose policies need them; `private` must not be
-- included in Dashboard > API > Exposed schemas.
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_registered_user() to authenticated;
grant execute on function private.has_org_role(uuid, public.org_role[]) to anon, authenticated;
grant execute on function private.can_view_logo(text) to anon, authenticated;
grant execute on function private.can_edit_logo(text) to authenticated;
grant execute on function private.can_admin_logo(text) to authenticated;
grant execute on function private.candidate_logo_id(uuid) to anon, authenticated;
grant execute on function private.can_manage_brand_entity(uuid) to authenticated;
grant execute on function private.can_view_brand_entity(uuid) to anon, authenticated;
grant execute on function private.can_view_logo_transfer_request(uuid) to authenticated;
grant execute on function private.can_view_user_profile(uuid) to authenticated;

-- Account profiles are no longer public. Registered users may see themselves
-- and fellow organization members, which is sufficient for the roster UI.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_user_profile(user_id)
  );

drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (private.is_registered_user() and user_id = auth.uid())
  with check (private.is_registered_user() and user_id = auth.uid());

-- Organization and commerce features are registered-account features. Guest
-- sessions continue to work for personal logo upload/editing only.
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations
  for select to authenticated
  using (
    private.is_registered_user()
    and (
      created_by = auth.uid()
      or private.has_org_role(
        org_id,
        array['owner','admin','editor','purchaser','viewer']::public.org_role[]
      )
    )
  );

drop policy if exists orgs_insert on public.organizations;
create policy orgs_insert on public.organizations
  for insert to authenticated
  with check (private.is_registered_user() and created_by = auth.uid());

drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations
  for update to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(org_id, array['owner']::public.org_role[])
  );

drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members
  for select to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(
      org_id,
      array['owner','admin','editor','purchaser','viewer']::public.org_role[]
    )
  );

drop policy if exists org_members_write on public.org_members;
create policy org_members_write on public.org_members
  for all to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(org_id, array['owner','admin']::public.org_role[])
  )
  with check (
    private.is_registered_user()
    and private.has_org_role(org_id, array['owner','admin']::public.org_role[])
  );

drop policy if exists invites_rw on public.org_invites;
create policy invites_rw on public.org_invites
  for all to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(org_id, array['owner','admin']::public.org_role[])
  )
  with check (
    private.is_registered_user()
    and private.has_org_role(org_id, array['owner','admin']::public.org_role[])
  );

drop policy if exists handles_write on public.handles;
create policy handles_write on public.handles
  for all to authenticated
  using (
    private.is_registered_user()
    and (
      user_id = auth.uid()
      or private.has_org_role(org_id, array['owner','admin']::public.org_role[])
    )
  )
  with check (
    private.is_registered_user()
    and (
      user_id = auth.uid()
      or private.has_org_role(org_id, array['owner','admin']::public.org_role[])
    )
  );

drop policy if exists bookmarks_select on public.bookmarks;
create policy bookmarks_select on public.bookmarks
  for select to authenticated
  using (private.is_registered_user() and user_id = auth.uid());
drop policy if exists bookmarks_insert on public.bookmarks;
create policy bookmarks_insert on public.bookmarks
  for insert to authenticated
  with check (
    private.is_registered_user()
    and user_id = auth.uid()
    and private.can_view_logo(logo_id)
  );
drop policy if exists bookmarks_delete on public.bookmarks;
create policy bookmarks_delete on public.bookmarks
  for delete to authenticated
  using (private.is_registered_user() and user_id = auth.uid());

drop policy if exists inventory_select on public.inventory_items;
create policy inventory_select on public.inventory_items
  for select to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(
      org_id,
      array['owner','admin','editor','purchaser','viewer']::public.org_role[]
    )
  );
drop policy if exists inventory_write on public.inventory_items;
create policy inventory_write on public.inventory_items
  for all to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(
      org_id,
      array['owner','admin','purchaser']::public.org_role[]
    )
  )
  with check (
    private.is_registered_user()
    and private.has_org_role(
      org_id,
      array['owner','admin','purchaser']::public.org_role[]
    )
  );

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    private.is_registered_user()
    and private.has_org_role(
      org_id,
      array['owner','admin','editor','purchaser','viewer']::public.org_role[]
    )
  );
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    private.is_registered_user()
    and ordered_by = auth.uid()
    and private.has_org_role(
      org_id,
      array['owner','admin','purchaser']::public.org_role[]
    )
  );

drop policy if exists generation_events_insert_own on public.generation_events;
create policy generation_events_insert_own on public.generation_events
  for insert to authenticated
  with check (private.is_registered_user() and user_id = auth.uid());
drop policy if exists generation_events_select_own on public.generation_events;
create policy generation_events_select_own on public.generation_events
  for select to authenticated
  using (private.is_registered_user() and user_id = auth.uid());

drop policy if exists logo_asset_runs_select on public.logo_asset_runs;
create policy logo_asset_runs_select on public.logo_asset_runs
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_logo(private.candidate_logo_id(candidate_id))
  );
drop policy if exists logo_asset_runs_insert on public.logo_asset_runs;
create policy logo_asset_runs_insert on public.logo_asset_runs
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_edit_logo(private.candidate_logo_id(candidate_id))
    and (triggered_by is null or triggered_by = auth.uid())
  );
drop policy if exists logo_asset_runs_update on public.logo_asset_runs;
create policy logo_asset_runs_update on public.logo_asset_runs
  for update to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_logo(private.candidate_logo_id(candidate_id))
  )
  with check (
    private.is_registered_user()
    and private.can_edit_logo(private.candidate_logo_id(candidate_id))
  );
drop policy if exists logo_asset_runs_delete on public.logo_asset_runs;
create policy logo_asset_runs_delete on public.logo_asset_runs
  for delete to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_logo(private.candidate_logo_id(candidate_id))
  );

drop policy if exists logo_transfer_requests_select on public.logo_transfer_requests;
create policy logo_transfer_requests_select on public.logo_transfer_requests
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_logo_transfer_request(id)
  );
drop policy if exists logo_transfer_requests_insert on public.logo_transfer_requests;
create policy logo_transfer_requests_insert on public.logo_transfer_requests
  for insert to authenticated
  with check (
    private.is_registered_user()
    and requested_by = auth.uid()
    and exists (
      select 1
      from public.logos l
      where l.id = logo_id
        and l.owner_user_id is not distinct from source_owner_user_id
        and l.owner_org_id is not distinct from source_owner_org_id
    )
    and (
      (request_kind = 'ownership_transfer' and private.can_admin_logo(logo_id))
      or (request_kind = 'purchase_inquiry' and private.can_view_logo(logo_id))
    )
  );

-- A tag must be normalized and bounded; this keeps the global dictionary from
-- becoming an unrestricted arbitrary-text sink while preserving guest edits.
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags
  for insert to authenticated
  with check (
    name = lower(btrim(name))
    and char_length(name) between 1 and 48
    and name !~ '[[:cntrl:]]'
  );

-- Generated assets now live in Cloudflare R2. Keep the seven unreferenced
-- legacy objects for manual review, but make their old Supabase bucket private
-- and remove all browser access.
update storage.buckets set public = false where id = 'mockups';
drop policy if exists "mockups public read" on storage.objects;
drop policy if exists "mockups authenticated write" on storage.objects;

-- Verification (expected: all internal definer functions are in `private`,
-- the old bucket is private, and no public users policy remains).
select
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ) as no_public_security_definer_functions,
  (select not public from storage.buckets where id = 'mockups') as mockups_bucket_private;
