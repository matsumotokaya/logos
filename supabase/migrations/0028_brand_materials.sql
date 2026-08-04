-- ============================================================================
-- 0028 - materials in three scopes, and the input pins of a take
--
-- Design: docs/schema-v2.md §10
--
-- One table, three scopes, narrowest by default:
--
--   scope='take'   only this take needs it (the default)
--   scope='work'   the initiative's takes share it (an event's photos)
--   scope='brand'  used again and again, inherited by child brands
--
-- Promotion WIDENS THE SCOPE OF THE SAME ROW. The id and the R2 key never
-- change, so nothing that already referenced the material breaks. Narrowing is
-- refused for everyone, including admins: it would strand takes that depend on
-- the wider scope.
--
-- brand_id is filled in for every scope so one predicate answers "who may see
-- this", and the brand library is simply scope='brand'.
--
-- Logo bytes are never copied here: a logo material points at the canonical
-- logo_candidates row.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.brand_materials (
  id                       uuid primary key default gen_random_uuid(),
  scope                    text not null check (scope in ('brand','work','take')),
  brand_id                 uuid not null references public.brand_entities(id) on delete restrict,
  work_id                  uuid references public.works(id) on delete cascade,
  take_id                  uuid references public.takes(id) on delete cascade,
  kind                     text not null check (kind in
                             ('logo','font','photo','keyvisual','illustration',
                              'audio','video','document','other')),
  label                    text not null default '',
  media_type               text,
  r2_key                   text,
  logo_id                  text references public.logos(id) on delete set null,
  logo_candidate_id        uuid references public.logo_candidates(id) on delete set null,
  bytes                    bigint,
  checksum                 text,
  width                    integer,
  height                   integer,
  duration_ms              integer,
  source_kind              text not null check (source_kind in
                             ('upload','url_fetch','ai_generated','derived','render_output')),
  source_url               text,
  derived_from_material_id uuid references public.brand_materials(id) on delete set null,
  origin_artifact_id       uuid references public.render_artifacts(id) on delete set null,
  provenance               jsonb not null default '{}'::jsonb,
  promoted_at              timestamptz,
  promoted_by              uuid references public.users(user_id) on delete set null,
  created_by               uuid references public.users(user_id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint materials_scope_owner check (
    (scope = 'brand' and work_id is null and take_id is null)
    or (scope = 'work' and work_id is not null and take_id is null)
    or (scope = 'take' and take_id is not null and work_id is null)
  ),
  constraint materials_has_body check (
    r2_key is not null or logo_candidate_id is not null
  ),
  constraint materials_no_self_derivation check (
    derived_from_material_id is null or derived_from_material_id <> id
  )
);
alter table public.brand_materials enable row level security;

create index if not exists brand_materials_brand_scope_idx
  on public.brand_materials (brand_id, scope, kind, created_at desc);
create index if not exists brand_materials_work_idx
  on public.brand_materials (work_id) where work_id is not null;
create index if not exists brand_materials_take_idx
  on public.brand_materials (take_id) where take_id is not null;
create index if not exists brand_materials_r2_key_idx
  on public.brand_materials (r2_key) where r2_key is not null;
create index if not exists brand_materials_artifact_idx
  on public.brand_materials (origin_artifact_id) where origin_artifact_id is not null;

comment on table public.brand_materials is
  'Materials in three scopes (take / work / brand). Promotion widens the scope of the same row; narrowing is impossible.';
comment on column public.brand_materials.brand_id is
  'Set for every scope so one view predicate covers the table. The brand library is scope=brand.';
comment on column public.brand_materials.logo_candidate_id is
  'A logo material points at the canonical master instead of duplicating its bytes.';
comment on column public.brand_materials.origin_artifact_id is
  'Set when this material was promoted from a render output. Both rows share one R2 object.';

-- Widening is a one-way, explicit act; the owning columns are rewritten to
-- match the new scope so a promoted row cannot keep a stale take_id.
create or replace function private.enforce_material_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case old.scope when 'take' then 1 when 'work' then 2 else 3 end;
  new_rank := case new.scope when 'take' then 1 when 'work' then 2 else 3 end;

  if new_rank < old_rank then
    raise exception 'A material''s scope can only widen (take -> work -> brand).'
      using errcode = '42501';
  end if;

  if new_rank > old_rank then
    if new.scope = 'brand' then
      new.work_id := null;
      new.take_id := null;
    elsif new.scope = 'work' then
      new.take_id := null;
      if new.work_id is null then
        raise exception 'Promoting to the work scope requires a work.';
      end if;
    end if;
    new.promoted_at := now();
    new.promoted_by := auth.uid();
  end if;

  if new.brand_id is distinct from old.brand_id then
    raise exception 'A material cannot be moved to another Brand.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_material_promotion()
  from public, anon, authenticated;

drop trigger if exists brand_materials_enforce_promotion on public.brand_materials;
create trigger brand_materials_enforce_promotion
  before update of scope, work_id, take_id, brand_id
  on public.brand_materials
  for each row execute function private.enforce_material_promotion();

-- ---------- the take's pinned inputs ---------------------------------------

create table if not exists public.take_inputs (
  take_id     uuid not null references public.takes(id) on delete cascade,
  material_id uuid not null references public.brand_materials(id) on delete restrict,
  role        text not null,
  checksum    text not null default '',
  pinned_at   timestamptz not null default now(),
  primary key (take_id, material_id, role)
);
alter table public.take_inputs enable row level security;

create index if not exists take_inputs_material_idx
  on public.take_inputs (material_id);

comment on table public.take_inputs is
  'Which exact material version a take consumed. ON DELETE RESTRICT is what stops a material a take depends on from being removed.';

-- ---------- policies --------------------------------------------------------

-- Viewing follows the brand (a viewer may see the material library).
-- Intake and editing need the output rung. WIDENING THE SCOPE needs the core
-- rung, because that is what fills the brand library — checked in the WITH
-- CHECK clause of a separate policy path below.

drop policy if exists brand_materials_select on public.brand_materials;
create policy brand_materials_select on public.brand_materials
  for select to authenticated
  using (private.is_registered_user() and private.can_view_brand_entity(brand_id));

drop policy if exists brand_materials_insert on public.brand_materials;
create policy brand_materials_insert on public.brand_materials
  for insert to authenticated
  with check (
    private.is_registered_user()
    and (created_by is null or created_by = auth.uid())
    and (
      -- Creating a row directly in the brand library is itself a library edit.
      case scope
        when 'brand' then private.can_edit_brand_core(brand_id)
        else private.can_edit_brand_output(brand_id)
      end
    )
  );

-- Two update policies: PostgreSQL ORs permissive policies together, so an
-- editor keeps ordinary edits while only the core rung can land scope='brand'.
drop policy if exists brand_materials_update_output on public.brand_materials;
create policy brand_materials_update_output on public.brand_materials
  for update to authenticated
  using (private.is_registered_user() and private.can_edit_brand_output(brand_id))
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(brand_id)
    and scope <> 'brand'
  );

drop policy if exists brand_materials_update_core on public.brand_materials;
create policy brand_materials_update_core on public.brand_materials
  for update to authenticated
  using (private.is_registered_user() and private.can_edit_brand_core(brand_id))
  with check (private.is_registered_user() and private.can_edit_brand_core(brand_id));

drop policy if exists brand_materials_delete on public.brand_materials;
create policy brand_materials_delete on public.brand_materials
  for delete to authenticated
  using (private.is_registered_user() and private.can_edit_brand_core(brand_id));

drop policy if exists take_inputs_select on public.take_inputs;
create policy take_inputs_select on public.take_inputs
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_brand_entity(private.take_brand_id(take_id))
  );

drop policy if exists take_inputs_write on public.take_inputs;
create policy take_inputs_write on public.take_inputs
  for all to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  )
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  );

-- ---------- verification ---------------------------------------------------

select
  to_regclass('public.brand_materials') is not null as has_brand_materials,
  to_regclass('public.take_inputs') is not null as has_take_inputs,
  to_regprocedure('private.enforce_material_promotion()') is not null
    as has_promotion_guard,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_materials'
      and policyname = 'brand_materials_update_core'
  ) as core_rung_guards_library;
