-- ============================================================================
-- 0025 - the template version ledger
--
-- Design: docs/schema-v2.md §8
--
-- Templates are AUTHORED in code (lib/video/templates.ts generalised to every
-- tool kind). This table is not a copy of that authority — it is the ledger of
-- versions that have existed, so that:
--
--   * a Take pinning (template_id, version) can prove that version was real,
--     instead of pointing at nothing after a refactor
--   * "may this take be re-rendered on its original version" is a recorded
--     declaration, not a guess
--   * promotion from draft to production stays an operator action, the same
--     way presentation_asset_definitions.release_stage already works
--
-- Rows are upserted idempotently by a deploy-time sync (service_role). No
-- client may write them.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.template_versions (
  template_id          text not null check (template_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  version              integer not null check (version > 0),
  tool_kind            text not null check (tool_kind in (
                         'lp','video','banner','guideline','logo_presentation',
                         'site','merch','document','other'
                       )),
  brief_schema_version integer not null check (brief_schema_version > 0),
  renderer_revision    text not null default '',
  definition_hash      text not null default '',
  stage                text not null default 'draft'
                       check (stage in ('draft','production')),
  spec                 jsonb not null default '{}'::jsonb,
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  primary key (template_id, version),
  -- A production template must record when it was released, so "which version
  -- was live when this take was made" is answerable.
  check (stage <> 'production' or published_at is not null)
);
alter table public.template_versions enable row level security;

-- Superset of the primary key: lets takes carry tool_kind and have the database
-- prove it matches the template, with no trigger.
create unique index if not exists template_versions_tool_kind_uq
  on public.template_versions (template_id, version, tool_kind);
create index if not exists template_versions_stage_idx
  on public.template_versions (stage, tool_kind, template_id);

comment on table public.template_versions is
  'Ledger of template versions. Definitions live in code; this table exists so pinned versions are verifiable and promotion is auditable.';
comment on column public.template_versions.spec is
  'Declared stages, publishSurfaces, costProfile, isBrandDefault and rerenderable for this exact version.';
comment on column public.template_versions.definition_hash is
  'Hash of the code-side definition. A changed hash on an unchanged version means the ledger is stale and the sync must run.';

-- The catalog is readable by any signed-in user (the add dialog needs it).
-- Writes have no policy at all: only service_role, which bypasses RLS.
drop policy if exists template_versions_select on public.template_versions;
create policy template_versions_select on public.template_versions
  for select to authenticated using (true);

select
  to_regclass('public.template_versions') is not null as has_template_versions,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'template_versions'
      and cmd <> 'SELECT'
  ) as no_client_write_policy;
