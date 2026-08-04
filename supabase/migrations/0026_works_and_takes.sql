-- ============================================================================
-- 0026 - Work (a thin campaign scope) and Take (one instance of an output)
--
-- Design: docs/schema-v2.md §9
--
-- Work is deliberately thin: id, brand, name, status and an optional period.
-- Objectives, offers and KPIs are not here. Work exists to be the scope that
-- materials and takes share, and the first generation must never ask for it —
-- the promotion of a material is what creates a Work.
--
-- A Take pins its template version, brief schema version and Brand at creation
-- and cannot move them afterwards. Locale, aspect ratio and theme are NOT take
-- properties (see 0027 take_renders) — that is the line that keeps the
-- combinatorial explosion out of this table.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- Work ------------------------------------------------------------

create table if not exists public.works (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brand_entities(id) on delete restrict,
  name       text not null,
  status     text not null default 'active' check (status in ('active','archived')),
  starts_on  date,
  ends_on    date,
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
alter table public.works enable row level security;

create index if not exists works_brand_created_idx
  on public.works (brand_id, created_at desc);

comment on table public.works is
  'Optional initiative scope (event, campaign, launch) that materials and takes can share. Single generations do not need one.';

-- ---------- Take ------------------------------------------------------------

create table if not exists public.takes (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references public.brand_entities(id) on delete restrict,
  variant_id           uuid,
  work_id              uuid references public.works(id) on delete set null,
  tool_kind            text not null,
  template_id          text not null,
  template_version     integer not null,
  brief_schema_version integer not null check (brief_schema_version > 0),
  brief                jsonb not null default '{}'::jsonb,
  title                text not null,
  status               text not null default 'draft'
                       check (status in ('draft','ready','failed','archived')),
  created_by           uuid references public.users(user_id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- The template must exist, and its declared tool_kind must be the one stored
  -- here. Enforced by the composite key rather than a trigger.
  foreign key (template_id, template_version, tool_kind)
    references public.template_versions(template_id, version, tool_kind)
    on delete restrict,
  -- MATCH SIMPLE: a NULL variant_id skips the check, which is what "this take
  -- addresses the brand as a whole" means.
  foreign key (variant_id, brand_id)
    references public.brand_variants(id, brand_id) on delete restrict
);
alter table public.takes enable row level security;

create index if not exists takes_brand_tool_created_idx
  on public.takes (brand_id, tool_kind, created_at desc);
create index if not exists takes_work_idx
  on public.takes (work_id) where work_id is not null;
create index if not exists takes_template_idx
  on public.takes (template_id, template_version);

comment on table public.takes is
  'One instance of an output (an LP, a video, a guideline). Template version and brief schema version are pinned at creation.';
comment on column public.takes.work_id is
  'ON DELETE SET NULL on purpose: an output outlives the initiative it was made for.';
comment on column public.takes.brief is
  'Template-shaped input, validated against the pinned briefSchema by the application. The database does not know its shape.';

-- What was chosen at creation stays chosen: re-pointing a take at a new
-- template version would silently invalidate the brief that was collected for
-- the old one (docs/deliverable-architecture.md §4.3).
create or replace function private.enforce_take_pins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.template_id is distinct from old.template_id
     or new.template_version is distinct from old.template_version
     or new.brief_schema_version is distinct from old.brief_schema_version
     or new.tool_kind is distinct from old.tool_kind then
    raise exception 'A take''s template and brief schema are fixed at creation.'
      using errcode = '42501';
  end if;
  if new.brand_id is distinct from old.brand_id then
    raise exception 'A take cannot be moved to another Brand.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_take_pins() from public, anon, authenticated;

drop trigger if exists takes_enforce_pins on public.takes;
create trigger takes_enforce_pins
  before update of
    template_id, template_version, brief_schema_version, tool_kind, brand_id
  on public.takes
  for each row execute function private.enforce_take_pins();

-- ---------- helpers used by the child tables' policies ---------------------

create or replace function private.take_brand_id(p_take_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select brand_id from public.takes where id = p_take_id;
$$;

revoke all on function private.take_brand_id(uuid) from public, anon, authenticated;
grant execute on function private.take_brand_id(uuid) to authenticated;

-- ---------- policies --------------------------------------------------------

-- Outputs are visible at the view rung: a viewer or purchaser can see what the
-- brand has made. Creation and editing need the output rung. Neither table has
-- a DELETE policy — deletion goes through the RPC in 0031, which also refuses
-- to remove anything that is currently published.

drop policy if exists works_select on public.works;
create policy works_select on public.works
  for select to authenticated
  using (private.is_registered_user() and private.can_view_brand_entity(brand_id));

drop policy if exists works_insert on public.works;
create policy works_insert on public.works
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(brand_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists works_update on public.works;
create policy works_update on public.works
  for update to authenticated
  using (private.is_registered_user() and private.can_edit_brand_output(brand_id))
  with check (private.is_registered_user() and private.can_edit_brand_output(brand_id));

drop policy if exists takes_select on public.takes;
create policy takes_select on public.takes
  for select to authenticated
  using (private.is_registered_user() and private.can_view_brand_entity(brand_id));

drop policy if exists takes_insert on public.takes;
create policy takes_insert on public.takes
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(brand_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists takes_update on public.takes;
create policy takes_update on public.takes
  for update to authenticated
  using (private.is_registered_user() and private.can_edit_brand_output(brand_id))
  with check (private.is_registered_user() and private.can_edit_brand_output(brand_id));

-- ---------- verification ---------------------------------------------------

select
  to_regclass('public.works') is not null as has_works,
  to_regclass('public.takes') is not null as has_takes,
  to_regprocedure('private.take_brand_id(uuid)') is not null as has_take_brand_helper,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('takes','works') and cmd = 'DELETE'
  ) as deletion_is_rpc_only;
