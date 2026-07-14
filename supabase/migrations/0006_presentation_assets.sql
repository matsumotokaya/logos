-- ============================================================================
-- 0006 — presentation asset definitions + per-logo layout mappings
--
-- The original model treated presentations as "copy + generated mockup cache".
-- That is too weak for the intended product: users will eventually choose
-- which motion / mockup / generated asset appears in which presentation area.
--
-- This migration separates:
--   1. global asset definitions (what can be placed where)
--   2. per-logo layout mappings (which assets this logo chose)
--   3. per-candidate generated outputs (logo_mockups cache)
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.presentation_asset_definitions (
  id               text primary key,
  asset_kind       text not null
                   check (asset_kind in ('motion', 'mockup', 'generated')),
  source_lab       text not null
                   check (source_lab in ('motion', 'workflow', 'generative')),
  renderer_kind    text not null,
  title            text not null,
  note             text not null default '',
  impressions      text[] not null default '{}',
  allowed_placements jsonb not null default '[]'::jsonb,
  default_mappings jsonb not null default '[]'::jsonb,
  config           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.presentation_asset_definitions enable row level security;

drop policy if exists presentation_assets_select on public.presentation_asset_definitions;
create policy presentation_assets_select on public.presentation_asset_definitions
  for select using (true);

alter table public.logo_presentations
  add column if not exists layout jsonb not null
  default '{"version":1,"mappings":[]}'::jsonb;

alter table public.logo_mockups
  add column if not exists mockup_definition_id text
  references public.presentation_asset_definitions(id) on delete set null;

create index if not exists logo_mockups_definition_idx
  on public.logo_mockups (mockup_definition_id);

comment on table public.presentation_asset_definitions is
  'Global catalog of presentation-capable assets contributed by labs or built-ins.';

comment on column public.logo_presentations.layout is
  'Per-logo mapping overrides: selected presentation assets, order, placement, and enablement.';

comment on column public.logo_mockups.mockup_definition_id is
  'Which presentation asset definition produced this cached candidate-scoped mockup.';

-- Verification
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logo_presentations'
      and column_name = 'layout'
  ) as has_layout,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logo_mockups'
      and column_name = 'mockup_definition_id'
  ) as has_mockup_definition_id;
