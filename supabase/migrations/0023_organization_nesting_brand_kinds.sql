-- ============================================================================
-- 0023 - nested Organizations, the full Brand vocabulary, and Brand variants
--
-- Design: docs/schema-v2.md §5 §6
--
-- Three additive changes:
--   1. brand_organizations nest (holdings -> subsidiary -> ...). Access is NOT
--      derived from the nesting: the parent's linked_org_id is copied into the
--      child row at creation, and every permission check still reads only its
--      own row. Selling a subsidiary and detaching it must not silently change
--      who can edit its brands.
--   2. brand_kind covers every market-facing subject we can name today.
--      'audience' leaves the vocabulary (zero rows) and becomes a variant.
--   3. brand_variants holds Personal / Business / Enterprise style differences
--      inside ONE Brand. A subject that keeps its own logo and palette over
--      time is a Brand; a subject that only addresses a different buyer is a
--      variant.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- 1. Organization nesting ----------------------------------------

alter table public.brand_organizations
  add column if not exists parent_organization_id uuid
    references public.brand_organizations(id) on delete restrict;

create index if not exists brand_organizations_parent_idx
  on public.brand_organizations (parent_organization_id)
  where parent_organization_id is not null;

do $$ begin
  alter table public.brand_organizations
    add constraint brand_organizations_no_self_parent
    check (parent_organization_id is null or parent_organization_id <> id);
exception when duplicate_object then null; end $$;

-- Ancestry is answered by one recursive walk here, never inside an RLS policy.
create or replace function private.organization_is_ancestor(
  p_ancestor_id uuid,
  p_descendant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive lineage as (
    select id, parent_organization_id
    from public.brand_organizations
    where id = p_descendant_id
    union all
    select parent.id, parent.parent_organization_id
    from public.brand_organizations parent
    join lineage child on child.parent_organization_id = parent.id
  )
  select p_ancestor_id is not null
     and exists (select 1 from lineage where id = p_ancestor_id);
$$;

revoke all on function private.organization_is_ancestor(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.organization_is_ancestor(uuid, uuid)
  to authenticated;

-- A cycle would make every ancestor walk non-terminating, and unbounded depth
-- would make the left pane's tree query cost unpredictable.
create or replace function private.enforce_organization_nesting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  depth integer := 0;
  cursor_id uuid;
  parent_linked_org_id uuid;
begin
  if new.parent_organization_id is null then
    return new;
  end if;

  if new.parent_organization_id = new.id then
    raise exception 'An Organization cannot contain itself.';
  end if;

  if private.organization_is_ancestor(new.id, new.parent_organization_id) then
    raise exception 'Organization nesting cannot form a cycle.';
  end if;

  cursor_id := new.parent_organization_id;
  while cursor_id is not null and depth < 8 loop
    select parent_organization_id into cursor_id
    from public.brand_organizations
    where id = cursor_id;
    depth := depth + 1;
  end loop;
  if cursor_id is not null then
    raise exception 'Organization nesting is limited to 8 levels.';
  end if;

  -- Copy the parent's workspace at creation instead of walking ancestors at
  -- read time (docs/schema-v2.md §5). Without this, a child Organization that
  -- an intake flow created automatically would be invisible to the members of
  -- the workspace that owns the parent.
  if new.linked_org_id is null then
    select linked_org_id into parent_linked_org_id
    from public.brand_organizations
    where id = new.parent_organization_id;
    new.linked_org_id := parent_linked_org_id;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_organization_nesting()
  from public, anon, authenticated;

drop trigger if exists brand_organizations_enforce_nesting
  on public.brand_organizations;
create trigger brand_organizations_enforce_nesting
  before insert or update of parent_organization_id, linked_org_id
  on public.brand_organizations
  for each row execute function private.enforce_organization_nesting();

-- A child may only be attached to a parent the caller can already manage,
-- otherwise a guessed UUID would place a row inside someone else's group.
drop policy if exists brand_organizations_insert on public.brand_organizations;
create policy brand_organizations_insert on public.brand_organizations
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      linked_org_id is null
      or private.has_org_role(
        linked_org_id,
        array['owner','admin']::public.org_role[]
      )
    )
    and (
      parent_organization_id is null
      or private.can_manage_brand_organization(parent_organization_id)
    )
  );

drop policy if exists brand_organizations_update on public.brand_organizations;
create policy brand_organizations_update on public.brand_organizations
  for update to authenticated
  using (private.can_manage_brand_organization(id))
  with check (
    private.can_manage_brand_organization(id)
    and (
      parent_organization_id is null
      or private.can_manage_brand_organization(parent_organization_id)
    )
  );

comment on column public.brand_organizations.parent_organization_id is
  'Optional real-world container parent (group -> subsidiary). Access is never derived from it; linked_org_id is copied at creation instead.';

-- ---------- 2. Brand vocabulary --------------------------------------------

-- Checked before the constraint changes, so the failure names the real problem
-- instead of surfacing as a bare check violation on ALTER TABLE.
do $$
begin
  if exists (select 1 from public.brand_entities where brand_kind = 'audience') then
    raise exception 'audience Brands exist. Fold them into brand_variants before applying 0023.';
  end if;
end;
$$;

alter table public.brand_entities
  drop constraint if exists brand_entities_brand_kind_check;
alter table public.brand_entities
  add constraint brand_entities_brand_kind_check
  check (
    brand_kind is null
    or brand_kind in ('corporate','business','service','product','media','event')
  );

-- The 0021 rule allowed business->corporate and audience->business only. With
-- the wider vocabulary the useful pairs are open-ended (a service inheriting a
-- business brand is ordinary), so keep only the two invariants that matter:
-- corporate is a root, and inheritance never crosses Organizations.
create or replace function public.enforce_brand_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_kind text;
  parent_organization_id uuid;
begin
  -- Legacy Organization rows remain until the contract migration removes them.
  if new.brand_kind is null then
    if new.entity_type <> 'organization' then
      raise exception 'Every market-facing entity must have a brand kind.';
    end if;
    return new;
  end if;

  if new.brand_organization_id is null then
    raise exception 'Every Brand must belong to an Organization.';
  end if;
  if new.entity_type not in ('brand', 'business', 'audience') then
    raise exception 'A Brand cannot use Organization as its entity type.';
  end if;
  if new.brand_kind = 'corporate' and new.parent_brand_id is not null then
    raise exception 'A corporate Brand cannot inherit from another Brand.';
  end if;
  if new.is_primary_brand and new.brand_kind <> 'corporate' then
    raise exception 'Only a corporate Brand may be the primary Brand.';
  end if;

  if new.parent_brand_id is not null then
    if new.parent_brand_id = new.id then
      raise exception 'A Brand cannot inherit from itself.';
    end if;

    select parent.brand_kind, parent.brand_organization_id
      into parent_kind, parent_organization_id
    from public.brand_entities parent
    where parent.id = new.parent_brand_id;

    if parent_kind is null then
      raise exception 'A parent Brand must reference another Brand.';
    end if;
    if parent_organization_id <> new.brand_organization_id then
      raise exception 'A Brand cannot inherit across Organizations.';
    end if;
  end if;

  return new;
end;
$$;

comment on column public.brand_entities.brand_kind is
  'corporate | business | service | product | media | event. NULL only on legacy Organization rows during the expand phase.';

-- ---------- 3. Brand variants ----------------------------------------------

create table if not exists public.brand_variants (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_entities(id) on delete cascade,
  key        text not null check (key ~ '^[a-z0-9][a-z0-9-]{0,30}$'),
  label      text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_default boolean not null default false,
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, key)
);
alter table public.brand_variants enable row level security;

-- Composite target so every row that carries (brand_id, variant_id) can prove
-- the variant belongs to that Brand (same device as logo_variants -> lockups).
create unique index if not exists brand_variants_id_brand_uq
  on public.brand_variants (id, brand_id);
create unique index if not exists brand_variants_default_uq
  on public.brand_variants (brand_id) where is_default;
create index if not exists brand_variants_brand_order_idx
  on public.brand_variants (brand_id, sort_order, created_at);

comment on table public.brand_variants is
  'Audience variants inside one Brand (Personal / Business / Enterprise). A subject with its own continuing identity is a Brand, not a variant.';

-- Policies are replaced in 0024 once the permission ladder exists; until then
-- variants follow the same rule as the Brand they belong to.
drop policy if exists brand_variants_select on public.brand_variants;
create policy brand_variants_select on public.brand_variants
  for select to authenticated
  using (private.can_view_brand_entity(brand_id));

drop policy if exists brand_variants_write on public.brand_variants;
create policy brand_variants_write on public.brand_variants
  for all to authenticated
  using (private.can_manage_brand_entity(brand_id))
  with check (private.can_manage_brand_entity(brand_id));

-- ---------- migration contract checks --------------------------------------

do $$
begin
  if exists (
    select 1 from public.brand_entities where brand_kind = 'audience'
  ) then
    raise exception 'Migration contract failed: audience Brands exist and must be folded into brand_variants first.';
  end if;

  if exists (
    select 1
    from public.brand_organizations organization
    where organization.parent_organization_id = organization.id
  ) then
    raise exception 'Migration contract failed: an Organization is its own parent.';
  end if;
end;
$$;

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brand_organizations'
      and column_name = 'parent_organization_id'
  ) as has_organization_nesting,
  to_regclass('public.brand_variants') is not null as has_brand_variants,
  to_regprocedure('private.organization_is_ancestor(uuid,uuid)') is not null
    as has_ancestor_helper,
  not exists (
    select 1 from public.brand_entities where brand_kind = 'audience'
  ) as no_audience_brands;
