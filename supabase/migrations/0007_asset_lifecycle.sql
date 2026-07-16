-- ============================================================================
-- 0007 - asset lifecycle, immutable versions, and candidate-scoped runs
--
-- Every asset lives in the Lab catalog. release_stage controls whether it is
-- eligible for end-user presentation composition; per-logo enablement remains
-- in logo_presentations.layout and is intentionally independent.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.presentation_asset_definitions
  add column if not exists family_id text;
alter table public.presentation_asset_definitions
  add column if not exists definition_version integer;
alter table public.presentation_asset_definitions
  add column if not exists release_stage text;
alter table public.presentation_asset_definitions
  add column if not exists released_at timestamptz;

-- Definitions that existed before lifecycle tracking are already in the live
-- presentation catalog, so preserve their behavior as production assets.
update public.presentation_asset_definitions
set
  family_id = coalesce(family_id, id),
  definition_version = coalesce(definition_version, 1),
  release_stage = coalesce(release_stage, 'production'),
  released_at = coalesce(released_at, created_at)
where family_id is null
   or definition_version is null
   or release_stage is null
   or (release_stage = 'production' and released_at is null);

alter table public.presentation_asset_definitions
  alter column family_id set not null,
  alter column definition_version set not null,
  alter column definition_version set default 1,
  alter column release_stage set not null,
  alter column release_stage set default 'draft';

alter table public.presentation_asset_definitions
  drop constraint if exists presentation_asset_definitions_version_check;
alter table public.presentation_asset_definitions
  add constraint presentation_asset_definitions_version_check
  check (definition_version > 0);

alter table public.presentation_asset_definitions
  drop constraint if exists presentation_asset_definitions_release_stage_check;
alter table public.presentation_asset_definitions
  add constraint presentation_asset_definitions_release_stage_check
  check (release_stage in ('draft', 'production'));

create unique index if not exists presentation_asset_family_version_uq
  on public.presentation_asset_definitions (family_id, definition_version);
create index if not exists presentation_asset_release_stage_idx
  on public.presentation_asset_definitions (release_stage, source_lab);

comment on column public.presentation_asset_definitions.family_id is
  'Stable family key shared by immutable definition versions.';
comment on column public.presentation_asset_definitions.definition_version is
  'Immutable version within family_id. Layout mappings point to a concrete definition id.';
comment on column public.presentation_asset_definitions.release_stage is
  'Operator-owned maturity gate: draft stays in Labs; production is eligible for presentation UI.';

create table if not exists public.logo_asset_runs (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references public.logo_candidates(id) on delete cascade,
  asset_definition_id text not null references public.presentation_asset_definitions(id),
  status              text not null default 'queued'
                      check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  params              jsonb not null default '{}'::jsonb,
  output_path         text,
  error_message       text,
  triggered_by        uuid references public.users(user_id) on delete set null,
  queued_at           timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.logo_asset_runs enable row level security;

create index if not exists logo_asset_runs_candidate_definition_idx
  on public.logo_asset_runs (candidate_id, asset_definition_id, created_at desc);
create index if not exists logo_asset_runs_queue_idx
  on public.logo_asset_runs (status, queued_at)
  where status in ('queued', 'running');

drop policy if exists logo_asset_runs_select on public.logo_asset_runs;
create policy logo_asset_runs_select on public.logo_asset_runs
  for select using (public.can_edit_logo(public.candidate_logo_id(candidate_id)));

drop policy if exists logo_asset_runs_insert on public.logo_asset_runs;
create policy logo_asset_runs_insert on public.logo_asset_runs
  for insert to authenticated with check (
    public.can_edit_logo(public.candidate_logo_id(candidate_id))
    and (triggered_by is null or triggered_by = auth.uid())
  );

drop policy if exists logo_asset_runs_update on public.logo_asset_runs;
create policy logo_asset_runs_update on public.logo_asset_runs
  for update using (
    public.can_edit_logo(public.candidate_logo_id(candidate_id))
  ) with check (
    public.can_edit_logo(public.candidate_logo_id(candidate_id))
  );

drop policy if exists logo_asset_runs_delete on public.logo_asset_runs;
create policy logo_asset_runs_delete on public.logo_asset_runs
  for delete using (public.can_edit_logo(public.candidate_logo_id(candidate_id)));

comment on table public.logo_asset_runs is
  'Append-oriented execution records for one candidate and one immutable asset definition version.';

alter table public.logo_mockups
  add column if not exists asset_run_id uuid
  references public.logo_asset_runs(id) on delete set null;
alter table public.logo_mockups
  add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.logo_mockups
  add column if not exists updated_at timestamptz not null default now();

create index if not exists logo_mockups_asset_run_idx
  on public.logo_mockups (asset_run_id);

comment on column public.logo_mockups.asset_run_id is
  'Successful run that produced the current cached output for this slot.';
comment on column public.logo_mockups.params is
  'Resolved per-logo output parameters, such as color or material choices.';

-- First runtime-Blender candidate. It is visible in Workflow Lab but cannot
-- enter a user presentation until an operator promotes it to production.
insert into public.presentation_asset_definitions (
  id,
  family_id,
  definition_version,
  release_stage,
  asset_kind,
  source_lab,
  renderer_kind,
  title,
  note,
  impressions,
  allowed_placements,
  default_mappings,
  config
) values (
  'workflow-neon-sign-v1',
  'workflow-neon-sign',
  1,
  'draft',
  'mockup',
  'workflow',
  'runtime-blender',
  'Neon sign',
  'Runtime Blender candidate. SVG paths become emissive tubes and are rendered per logo.',
  array['neon', 'signage', 'runtime'],
  '["onsite.primary"]'::jsonb,
  '[]'::jsonb,
  jsonb_build_object(
    'script', 'labs/workflow/scripts/blender/neon_sign.py',
    'parameters', jsonb_build_object(
      'colorMode', jsonb_build_object(
        'type', 'string',
        'enum', jsonb_build_array('logo', 'warm-white'),
        'default', 'logo'
      )
    )
  )
)
on conflict (id) do nothing;

-- Verification
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presentation_asset_definitions'
      and column_name = 'release_stage'
  ) as has_release_stage,
  to_regclass('public.logo_asset_runs') is not null as has_logo_asset_runs,
  exists (
    select 1 from public.presentation_asset_definitions
    where id = 'workflow-neon-sign-v1' and release_stage = 'draft'
  ) as has_draft_neon;
