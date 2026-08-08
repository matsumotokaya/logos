-- ============================================================================
-- 0038 - connect the legacy event-promo asset to its v2 Take
--
-- The first event Take was created as an end-to-end proof before the generic
-- idempotency columns existed. Reuse that Take when present; on a fresh setup,
-- create the same logical Take from the legacy asset. No legacy row is changed.
-- ============================================================================

with legacy as (
  select
    asset.id as asset_id,
    asset.brand_id,
    asset.title,
    asset.metadata -> 'brief' as brief,
    asset.created_by,
    asset.created_at
  from public.brand_assets asset
  where asset.asset_kind = 'video'
    and asset.metadata ->> 'template' = 'event-promo'
    and jsonb_typeof(asset.metadata -> 'brief') = 'object'
), candidates as (
  select distinct on (legacy.asset_id)
    legacy.asset_id,
    take.id as take_id
  from legacy
  join public.takes take
    on take.brand_id = legacy.brand_id
   and take.template_id = 'event-promo'
   and take.title = legacy.title
   and take.idempotency_key is null
  order by legacy.asset_id, take.created_at, take.id
)
update public.takes take
set
  idempotency_key = 'legacy-brand-asset:' || candidates.asset_id::text,
  request_hash = encode(digest(candidates.asset_id::text, 'sha256'), 'hex'),
  updated_at = now()
from candidates
where take.id = candidates.take_id
  and not exists (
    select 1
    from public.takes keyed
    where keyed.brand_id = take.brand_id
      and keyed.template_id = 'event-promo'
      and keyed.idempotency_key = 'legacy-brand-asset:' || candidates.asset_id::text
  );

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
  legacy.brand_id,
  'video',
  'event-promo',
  1,
  1,
  legacy.brief,
  legacy.title,
  'draft',
  legacy.created_by,
  legacy.created_at,
  legacy.created_at,
  'legacy-brand-asset:' || legacy.asset_id::text,
  encode(digest(legacy.asset_id::text, 'sha256'), 'hex')
from legacy
where not exists (
  select 1
  from public.takes take
  where take.brand_id = legacy.brand_id
    and take.template_id = 'event-promo'
    and take.idempotency_key = 'legacy-brand-asset:' || legacy.asset_id::text
);

insert into public.take_renders (
  take_id, locale, aspect_ratio, theme, format, status, created_at, updated_at
)
select take.id, 'ja', '16:9', 'sumi', 'mp4', 'pending', take.created_at, take.created_at
from public.takes take
where take.template_id = 'event-promo'
  and take.idempotency_key like 'legacy-brand-asset:%'
  and not exists (
    select 1 from public.take_renders render
    where render.take_id = take.id
      and render.locale = 'ja'
      and render.aspect_ratio = '16:9'
      and render.theme = 'sumi'
      and render.format = 'mp4'
  );

select count(*) as ported_event_promo_takes
from public.takes
where template_id = 'event-promo'
  and idempotency_key like 'legacy-brand-asset:%';
