-- ============================================================================
-- 0039 - port legacy LP assets and generation history into v2
--
-- Every LP asset has a matching Brand Kit snapshot on brand_generation_runs.
-- This migration creates a pinned campaign-lp@2 Take, its responsive HTML
-- Render, and one imported structure Run. Rendering/R2 upload is intentionally
-- performed by scripts/migrate-v2-lps.ts after this transaction commits.
-- Legacy private LPs are not published by the migration.
-- ============================================================================

with source_rows as (
  select
    asset.id as asset_id,
    asset.brand_id,
    asset.title,
    asset.created_by,
    asset.created_at,
    run.id as legacy_run_id,
    run.external_job_id,
    run.input,
    run.steps,
    run.usage,
    run.status as run_status,
    run.error_message,
    run.triggered_by,
    run.started_at,
    run.finished_at,
    run.updated_at as run_updated_at,
    run.metadata -> 'brand_kit_snapshot' as kit
  from public.brand_assets asset
  join lateral (
    select candidate.*
    from public.brand_generation_runs candidate
    where candidate.id = asset.generation_run_id
       or candidate.external_job_id = asset.legacy_campaign_id
       or candidate.legacy_campaign_id = asset.legacy_campaign_id
    order by (candidate.id = asset.generation_run_id) desc,
             candidate.created_at desc,
             candidate.id desc
    limit 1
  ) run on true
  where asset.asset_kind = 'lp'
    and jsonb_typeof(run.metadata -> 'brand_kit_snapshot') = 'object'
)
insert into public.takes (
  brand_id,
  tool_kind,
  template_id,
  template_version,
  brief_schema_version,
  brief,
  title,
  status,
  created_by,
  created_at,
  updated_at,
  idempotency_key,
  request_hash
)
select
  source.brand_id,
  'lp',
  'campaign-lp',
  2,
  2,
  jsonb_build_object(
    'kit', source.kit,
    'campaignJobId', source.external_job_id,
    'sourceUrl', source.input ->> 'source_url',
    'theme', source.kit -> 'theme'
  ),
  source.title,
  'draft',
  coalesce(source.created_by, source.triggered_by),
  source.created_at,
  source.created_at,
  'legacy-brand-asset:' || source.asset_id::text,
  encode(digest(source.asset_id::text, 'sha256'), 'hex')
from source_rows source
where not exists (
  select 1
  from public.takes take
  where take.brand_id = source.brand_id
    and take.template_id = 'campaign-lp'
    and take.idempotency_key = 'legacy-brand-asset:' || source.asset_id::text
);

insert into public.take_renders (
  take_id, locale, aspect_ratio, theme, format, status, created_at, updated_at
)
select take.id, 'ja', 'responsive', '', 'html', 'pending', take.created_at, take.created_at
from public.takes take
where take.template_id = 'campaign-lp'
  and take.idempotency_key like 'legacy-brand-asset:%'
  and not exists (
    select 1 from public.take_renders render
    where render.take_id = take.id
      and render.locale = 'ja'
      and render.aspect_ratio = 'responsive'
      and render.theme = ''
      and render.format = 'html'
  );

with source_rows as (
  select
    asset.id as asset_id,
    run.id as legacy_run_id,
    run.external_job_id,
    run.input,
    run.steps,
    run.usage,
    run.status,
    run.error_message,
    run.triggered_by,
    run.started_at,
    run.finished_at,
    run.created_at,
    run.updated_at
  from public.brand_assets asset
  join lateral (
    select candidate.*
    from public.brand_generation_runs candidate
    where candidate.id = asset.generation_run_id
       or candidate.external_job_id = asset.legacy_campaign_id
       or candidate.legacy_campaign_id = asset.legacy_campaign_id
    order by (candidate.id = asset.generation_run_id) desc,
             candidate.created_at desc,
             candidate.id desc
    limit 1
  ) run on true
  where asset.asset_kind = 'lp'
)
insert into public.take_runs (
  take_id,
  stage,
  status,
  input,
  steps,
  usage,
  external_job_id,
  error_message,
  triggered_by,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  take.id,
  'structure',
  source.status,
  source.input || jsonb_build_object(
    'migrated_from', 'brand_generation_runs',
    'legacy_generation_run_id', source.legacy_run_id
  ),
  source.steps,
  source.usage,
  source.external_job_id,
  source.error_message,
  source.triggered_by,
  source.started_at,
  source.finished_at,
  source.created_at,
  source.updated_at
from source_rows source
join public.takes take
  on take.template_id = 'campaign-lp'
 and take.idempotency_key = 'legacy-brand-asset:' || source.asset_id::text
where source.external_job_id is not null
  and not exists (
    select 1 from public.take_runs existing
    where existing.external_job_id = source.external_job_id
  );

select
  count(*) as ported_lp_takes,
  count(*) filter (where render.id is not null) as ported_lp_renders,
  count(*) filter (where run.id is not null) as ported_generation_runs
from public.takes take
left join public.take_renders render on render.take_id = take.id and render.format = 'html'
left join public.take_runs run on run.take_id = take.id
where take.template_id = 'campaign-lp'
  and take.idempotency_key like 'legacy-brand-asset:%';
