-- ============================================================================
-- 0053 - what a material depicts, on the material
--
-- Design: docs/asset-normalization.md §5 (axis 1) / §14-2
-- Vocabulary: lib/materials/category.ts is the code source of truth.
--
-- Classification already happens — the structuring model reads every image and
-- says what it is — but the answer only ever reached take_runs.steps. So it was
-- re-decided (and re-charged) on every run, could not be filtered on, and could
-- not be carried to another take. The judgement outlives the run that made it,
-- so it belongs on the row.
--
-- The vocabulary is deliberately about CONTENT, not use:
--
--   person product screen place scenery mark graphic document texture other
--
-- The classifier's own words are event-cm's (`speaker-portrait`, `venue`, and
-- `key-visual` — which is a use, not a content type). Those do not survive
-- contact with a landing page or a banner, so they are translated on the way in.
--
-- THE LIST WILL GROW. Landing pages will want more, banners will want more.
-- Growing it is one line here and one line in the code table; nothing already
-- stored changes meaning. What does not go in this column: prices, testimonials
-- and taglines (those are claims — brand_knowledge_*), and resolution variants
-- (same content, different bytes — derived_from_material_id plus the measured
-- width from 0052).
--
-- category_source is what makes a wrong guess fixable AND self-healing:
-- 'inferred' may be replaced by the next run, 'user' never is. Same contract as
-- the scenario's source='human'.
--
-- NULL category means "not classified yet", which is not "other".
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.brand_materials
  add column if not exists category        text,
  add column if not exists category_source text;

alter table public.brand_materials
  drop constraint if exists materials_category_vocabulary;
alter table public.brand_materials
  add constraint materials_category_vocabulary
  check (category is null or category in
    ('person','product','screen','place','scenery',
     'mark','graphic','document','texture','other'));

alter table public.brand_materials
  drop constraint if exists materials_category_source_vocabulary;
alter table public.brand_materials
  add constraint materials_category_source_vocabulary
  check (category_source is null or category_source in ('inferred','user'));

-- A category with nobody behind it cannot be protected from the next run, and
-- a source with no category describes nothing. They travel together.
alter table public.brand_materials
  drop constraint if exists materials_category_has_source;
alter table public.brand_materials
  add constraint materials_category_has_source
  check ((category is null) = (category_source is null));

comment on column public.brand_materials.category is
  'What the material depicts (axis 1): person/product/screen/place/scenery/mark/graphic/document/texture/other. Independent of which deliverable uses it. NULL = not classified. Vocabulary: lib/materials/category.ts';
comment on column public.brand_materials.category_source is
  'Who decided: inferred (a run may replace it) or user (a run never may).';

-- The library view filters by what things are.
create index if not exists brand_materials_category_idx
  on public.brand_materials (brand_id, category)
  where category is not null;

-- ---------- verification ---------------------------------------------------

select
  count(*) filter (where category is not null)              as classified,
  count(*) filter (where category_source = 'user')          as corrected_by_hand,
  count(*)                                                  as total
from public.brand_materials;
