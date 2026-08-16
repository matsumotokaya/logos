-- ============================================================================
-- 0052 - what a material IS, measured once and kept on the row
--
-- Design: docs/asset-normalization.md §6 / §14-1
--
-- brand_materials already had width / height / source_url from 0028 and never
-- filled them (47/47 null on 2026-08-16). This adds the two measurements that
-- were missing entirely, and that decide how a mark may be drawn:
--
--   opaque      the artwork has no transparency — it arrived ON A PLATE
--   luminance   the artwork's own brightness, 0-1, weighted by opacity
--
-- They are separate questions with one answer only when read together. A white
-- mark on transparency and a black mark on a white JPEG plate both measure
-- bright, and on an ink ground they need opposite treatments. Getting that
-- wrong is what drew a partner's logo as a white rectangle.
--
-- Until now these were measured on every structuring run and survived only in
-- take_runs.steps, so the judgement could not be reused, filtered, or carried
-- to another take. The measurement is deterministic and free; the only thing
-- missing was somewhere to put it.
--
-- NULL means "not measured" and must not be read as "not opaque". Everything
-- registered before this migration is null, and stays null until something
-- measures it — no backfill here, because backfilling means fetching every
-- object out of R2, which is a script's job (docs §14-1), not a migration's.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.brand_materials
  add column if not exists opaque    boolean,
  add column if not exists luminance numeric(4,3);

alter table public.brand_materials
  drop constraint if exists materials_luminance_range;
alter table public.brand_materials
  add constraint materials_luminance_range
  check (luminance is null or (luminance >= 0 and luminance <= 1));

comment on column public.brand_materials.opaque is
  'Measured at intake: the artwork has no transparency (it arrived on a plate). NULL = not measured, which is not the same as false.';
comment on column public.brand_materials.luminance is
  'Measured at intake: mean luminance 0-1 of the non-transparent pixels — the artwork''s own brightness, not the space around it. NULL = not measured.';

-- Finding the marks whose treatment cannot be decided yet: the partial index
-- keeps the "still unmeasured" question cheap while the backfill is outstanding.
create index if not exists brand_materials_unmeasured_idx
  on public.brand_materials (brand_id, kind)
  where opaque is null and r2_key is not null;

-- ---------- verification ---------------------------------------------------

select
  count(*) filter (where opaque is not null)    as measured_opacity,
  count(*) filter (where luminance is not null) as measured_luminance,
  count(*) filter (where width is not null)     as measured_width,
  count(*)                                      as total
from public.brand_materials;
