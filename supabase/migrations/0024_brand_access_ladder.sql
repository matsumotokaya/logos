-- ============================================================================
-- 0024 - Brand-scoped sharing and the four-rung permission ladder
--
-- Design: docs/schema-v2.md §13 §14.1
--
-- Every v2 table is explained by four predicates instead of a role list:
--
--   can_view_brand_entity   viewer / purchaser and up, plus any grant
--                           -> outputs: takes, renders, artifacts, materials
--   can_edit_brand_output   editor and up, grant manager / editor
--                           -> takes, briefs, renders, material intake, runs
--   can_edit_brand_core     editor and up, grant manager ONLY
--                           -> Brand record, adopting knowledge, promoting
--                              a material to the brand library
--   can_admin_brand         owner / admin, or the creator of a personal Brand.
--                           Grants NEVER reach this rung.
--                           -> publication, deletion, managing shares
--
-- A grant gives operational access, never ownership: publishing, deleting and
-- re-sharing stay with the owning side (same rule as logo_access_grants).
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.brand_access_grants (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brand_entities(id) on delete cascade,
  grantee_user_id uuid references public.users(user_id) on delete cascade,
  grantee_org_id  uuid references public.organizations(org_id) on delete cascade,
  role            public.logo_access_role not null default 'viewer',
  granted_by      uuid references public.users(user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (num_nonnulls(grantee_user_id, grantee_org_id) = 1)
);
alter table public.brand_access_grants enable row level security;

create unique index if not exists brand_access_grants_user_uq
  on public.brand_access_grants (brand_id, grantee_user_id)
  where grantee_user_id is not null;
create unique index if not exists brand_access_grants_org_uq
  on public.brand_access_grants (brand_id, grantee_org_id)
  where grantee_org_id is not null;
create index if not exists brand_access_grants_user_idx
  on public.brand_access_grants (grantee_user_id, brand_id)
  where grantee_user_id is not null;
create index if not exists brand_access_grants_org_idx
  on public.brand_access_grants (grantee_org_id, brand_id)
  where grantee_org_id is not null;

comment on table public.brand_access_grants is
  'Brand-scoped operational access for partner agencies and studios. Publication, deletion and re-sharing remain with the owning side.';

-- ---------- rung 0: does a grant apply -------------------------------------

create or replace function private.has_brand_grant(
  p_brand_id uuid,
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
    from public.brand_access_grants grant_row
    where grant_row.brand_id = p_brand_id
      and grant_row.role = any(p_grant_roles)
      and (
        grant_row.grantee_user_id = auth.uid()
        or (
          grant_row.grantee_org_id is not null
          and private.has_org_role(grant_row.grantee_org_id, p_org_roles)
        )
      )
  );
$$;

-- ---------- rung 1: view ----------------------------------------------------

-- Extends the 0021 definition with grants. Viewers and purchasers already
-- reached this rung through org roles; 0022 closed brand_assets above it,
-- which is why a viewer cannot currently see their own brand's video list.
-- The v2 output tables open at this rung instead (docs/schema-v2.md §14.1).
create or replace function private.can_view_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_entity_id
      and (
        entity.created_by = auth.uid()
        or private.can_view_brand_organization(entity.brand_organization_id)
        or private.has_org_role(
          entity.linked_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or private.has_brand_grant(
          entity.id,
          array['manager','editor','viewer']::public.logo_access_role[],
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or exists (
          select 1
          from public.logos logo
          where logo.subject_entity_id = entity.id
            and private.can_view_logo(logo.id)
        )
      )
  );
$$;

-- ---------- rung 2: edit outputs -------------------------------------------

create or replace function private.can_edit_brand_output(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_brand_entity(p_brand_id)
     or private.has_brand_grant(
          p_brand_id,
          array['manager','editor']::public.logo_access_role[],
          array['owner','admin','editor']::public.org_role[]
        );
$$;

-- ---------- rung 3: edit the Brand record itself ---------------------------

create or replace function private.can_edit_brand_core(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_brand_entity(p_brand_id)
     or private.has_brand_grant(
          p_brand_id,
          array['manager']::public.logo_access_role[],
          array['owner','admin','editor']::public.org_role[]
        );
$$;

-- ---------- rung 4: publish, delete, share ---------------------------------

-- Deliberately grant-free. Publishing is outward-facing and irreversible, so
-- it stays with the owning side — the same line the logo `visibility` rule
-- already draws. A personally held Brand has no org roles, so its creator (or
-- the creator of its container) is the admin.
create or replace function private.can_admin_brand(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_brand_id is not null and exists (
    select 1
    from public.brand_entities entity
    left join public.brand_organizations container
      on container.id = entity.brand_organization_id
    where entity.id = p_brand_id
      and (
        entity.created_by = auth.uid()
        or container.created_by = auth.uid()
        or private.has_org_role(
          entity.linked_org_id,
          array['owner','admin']::public.org_role[]
        )
        or private.has_org_role(
          container.linked_org_id,
          array['owner','admin']::public.org_role[]
        )
      )
  );
$$;

-- ---------- grants on the helpers ------------------------------------------

revoke all on function private.has_brand_grant(
  uuid, public.logo_access_role[], public.org_role[]
) from public, anon, authenticated;
grant execute on function private.has_brand_grant(
  uuid, public.logo_access_role[], public.org_role[]
) to authenticated;

revoke all on function private.can_edit_brand_output(uuid)
  from public, anon, authenticated;
grant execute on function private.can_edit_brand_output(uuid) to authenticated;

revoke all on function private.can_edit_brand_core(uuid)
  from public, anon, authenticated;
grant execute on function private.can_edit_brand_core(uuid) to authenticated;

revoke all on function private.can_admin_brand(uuid)
  from public, anon, authenticated;
grant execute on function private.can_admin_brand(uuid) to authenticated;

-- ---------- policies on the grant table itself -----------------------------

revoke all on public.brand_access_grants from public, anon;
grant select, insert, delete on public.brand_access_grants to authenticated;
grant update (role, updated_at) on public.brand_access_grants to authenticated;

drop policy if exists brand_access_grants_select on public.brand_access_grants;
create policy brand_access_grants_select on public.brand_access_grants
  for select to authenticated
  using (
    private.is_registered_user()
    and (
      private.can_admin_brand(brand_id)
      or grantee_user_id = auth.uid()
      or private.has_org_role(
        grantee_org_id,
        array['owner','admin','editor','purchaser','viewer']::public.org_role[]
      )
    )
  );

drop policy if exists brand_access_grants_insert on public.brand_access_grants;
create policy brand_access_grants_insert on public.brand_access_grants
  for insert to authenticated
  with check (
    private.is_registered_user()
    and granted_by = auth.uid()
    and private.can_admin_brand(brand_id)
  );

drop policy if exists brand_access_grants_update on public.brand_access_grants;
create policy brand_access_grants_update on public.brand_access_grants
  for update to authenticated
  using (private.is_registered_user() and private.can_admin_brand(brand_id))
  with check (private.is_registered_user() and private.can_admin_brand(brand_id));

drop policy if exists brand_access_grants_delete on public.brand_access_grants;
create policy brand_access_grants_delete on public.brand_access_grants
  for delete to authenticated
  using (private.is_registered_user() and private.can_admin_brand(brand_id));

-- ---------- Brand record follows the new rungs -----------------------------

drop policy if exists brand_entities_update on public.brand_entities;
create policy brand_entities_update on public.brand_entities
  for update to authenticated
  using (private.can_edit_brand_core(id))
  with check (
    private.can_edit_brand_core(id)
    and (
      brand_kind is null
      or private.can_manage_brand_organization(brand_organization_id)
    )
  );

drop policy if exists brand_entities_delete on public.brand_entities;
create policy brand_entities_delete on public.brand_entities
  for delete to authenticated
  using (private.can_admin_brand(id));

drop policy if exists brand_variants_write on public.brand_variants;
create policy brand_variants_write on public.brand_variants
  for all to authenticated
  using (private.can_edit_brand_core(brand_id))
  with check (private.can_edit_brand_core(brand_id));

-- ---------- verification ---------------------------------------------------

select
  to_regclass('public.brand_access_grants') is not null as has_brand_grants,
  to_regprocedure('private.can_edit_brand_output(uuid)') is not null as has_output_rung,
  to_regprocedure('private.can_edit_brand_core(uuid)') is not null as has_core_rung,
  to_regprocedure('private.can_admin_brand(uuid)') is not null as has_admin_rung,
  not has_function_privilege('anon', 'private.can_admin_brand(uuid)', 'execute')
    as admin_rung_closed_to_anon;
