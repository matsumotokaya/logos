-- 0015_logo_access_grants.sql
-- Logo-scoped collaboration for external studios and designers. Ownership
-- remains singular; a grant provides operational access, never legal ownership.

do $$ begin
  create type public.logo_access_role as enum ('manager', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.logo_access_grants (
  id              uuid primary key default gen_random_uuid(),
  logo_id         text not null references public.logos(id) on delete cascade,
  grantee_user_id uuid references public.users(user_id) on delete cascade,
  grantee_org_id  uuid references public.organizations(org_id) on delete cascade,
  role            public.logo_access_role not null default 'viewer',
  granted_by      uuid references public.users(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(grantee_user_id, grantee_org_id) = 1)
);

alter table public.logo_access_grants enable row level security;

create unique index if not exists logo_access_grants_user_uq
  on public.logo_access_grants (logo_id, grantee_user_id)
  where grantee_user_id is not null;
create unique index if not exists logo_access_grants_org_uq
  on public.logo_access_grants (logo_id, grantee_org_id)
  where grantee_org_id is not null;
create index if not exists logo_access_grants_user_idx
  on public.logo_access_grants (grantee_user_id, logo_id)
  where grantee_user_id is not null;
create index if not exists logo_access_grants_org_idx
  on public.logo_access_grants (grantee_org_id, logo_id)
  where grantee_org_id is not null;

create or replace function private.has_logo_grant(
  p_logo_id text,
  p_grant_roles public.logo_access_role[],
  p_org_roles public.org_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.logo_access_grants lag
    where lag.logo_id = p_logo_id
      and lag.role = any(p_grant_roles)
      and (
        lag.grantee_user_id = auth.uid()
        or (
          lag.grantee_org_id is not null
          and private.has_org_role(lag.grantee_org_id, p_org_roles)
        )
      )
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
        or private.has_logo_grant(
          l.id,
          array['manager','editor','viewer']::public.logo_access_role[],
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
        or private.has_logo_grant(
          l.id,
          array['manager']::public.logo_access_role[],
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_edit_logo_presentation(p_logo_id text)
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
        or private.has_logo_grant(
          l.id,
          array['manager','editor']::public.logo_access_role[],
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

-- Row-level UPDATE permission must not allow editors to rewrite ownership.
create or replace function private.enforce_logo_owner_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.owner_user_id is distinct from old.owner_user_id
    or new.owner_org_id is distinct from old.owner_org_id
  ) and not private.can_admin_logo(old.id) then
    raise exception 'Only the logo owner may transfer ownership.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_logo_owner_admin on public.logos;
create trigger enforce_logo_owner_admin
  before update of owner_user_id, owner_org_id on public.logos
  for each row execute function private.enforce_logo_owner_admin();

revoke all on public.logo_access_grants from public, anon;
grant select, insert, delete on public.logo_access_grants to authenticated;
grant update (role, updated_at) on public.logo_access_grants to authenticated;

revoke all on function private.has_logo_grant(
  text,
  public.logo_access_role[],
  public.org_role[]
) from public, anon, authenticated;
grant execute on function private.has_logo_grant(
  text,
  public.logo_access_role[],
  public.org_role[]
) to authenticated;
revoke all on function private.can_edit_logo_presentation(text)
  from public, anon, authenticated;
grant execute on function private.can_edit_logo_presentation(text)
  to authenticated;

revoke all on function private.enforce_logo_owner_admin()
  from public, anon, authenticated;

drop policy if exists logo_access_grants_select
  on public.logo_access_grants;
create policy logo_access_grants_select
  on public.logo_access_grants
  for select to authenticated
  using (
    private.is_registered_user()
    and (
      private.can_admin_logo(logo_id)
      or grantee_user_id = auth.uid()
      or private.has_org_role(
        grantee_org_id,
        array['owner','admin','editor','purchaser','viewer']::public.org_role[]
      )
    )
  );

drop policy if exists logo_access_grants_insert
  on public.logo_access_grants;
create policy logo_access_grants_insert
  on public.logo_access_grants
  for insert to authenticated
  with check (
    private.is_registered_user()
    and granted_by = auth.uid()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists logo_access_grants_update
  on public.logo_access_grants;
create policy logo_access_grants_update
  on public.logo_access_grants
  for update to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  )
  with check (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists logo_access_grants_delete
  on public.logo_access_grants;
create policy logo_access_grants_delete
  on public.logo_access_grants
  for delete to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists presentations_write on public.logo_presentations;
create policy presentations_write on public.logo_presentations
  for all to authenticated
  using (private.can_edit_logo_presentation(logo_id))
  with check (private.can_edit_logo_presentation(logo_id));

drop policy if exists activities_select on public.logo_activities;
create policy activities_select on public.logo_activities
  for select to authenticated
  using (private.can_edit_logo_presentation(logo_id));

drop policy if exists activities_insert on public.logo_activities;
create policy activities_insert on public.logo_activities
  for insert to authenticated
  with check (
    private.can_edit_logo_presentation(logo_id)
    and (user_id is null or user_id = auth.uid())
  );
