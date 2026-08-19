-- ============================================================================
-- 0055 - where the artwork in a file actually is, and how much of it is ink
--
-- Design: docs/asset-normalization.md §11 (段階7)
--
-- 0052 recorded what a material IS (opaque / luminance). Those two decide how a
-- mark may be DRAWN. They cannot decide how big to draw it, and they cannot tell
-- a usable file from an awkward one:
--
--   trim_width  the artwork's own bounding box, in this file's pixels
--   trim_height (equal to width/height when the export left no padding)
--   ink_ratio   alpha-weighted coverage INSIDE that box, 0-1
--
-- Two things follow, neither of which was answerable before:
--
--   1. HOW MUCH PADDING the file carries — (trim_width * trim_height) over
--      (width * height). Supplied marks routinely arrive with a third of the
--      frame empty, and aligning two such files by their FILE box aligns their
--      padding rather than their marks. That is what the normalisation offer at
--      intake is measured against.
--   2. HOW MUCH INK the mark has at unit height — ink_ratio * (trim_width /
--      trim_height). A two-line lockup set to a one-line wordmark's height has
--      letters half the size and reads as the junior partner; designers match
--      the ink, not the box. lib/materials/optical.ts turns this into the
--      per-mark `scale` the film draws with.
--
-- ink_ratio is INTRINSIC to the artwork: the same mark exported with more
-- padding measures the same number, because the padding is outside the box being
-- measured. That is why it lives on the row and not on a run — and why the
-- trimmed derivative of a material carries the same value as its original.
--
-- No aspect column: it is trim_width / trim_height, and storing a value beside
-- the two numbers it is computed from is how the two disagree later (§8.1 made
-- the same call for names).
--
-- NULL means "not measured" and must not be read as "no padding". Everything
-- registered before this migration is null, and stays null until something
-- measures it — the backfill fetches bytes out of R2, which is a script's job
-- (npm run materials:measure), not a migration's.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.brand_materials
  add column if not exists ink_ratio   numeric(5,4),
  add column if not exists trim_width  integer,
  add column if not exists trim_height integer;

alter table public.brand_materials
  drop constraint if exists materials_ink_ratio_range;
alter table public.brand_materials
  add constraint materials_ink_ratio_range
  check (ink_ratio is null or (ink_ratio >= 0 and ink_ratio <= 1));

-- The artwork cannot be bigger than the file that holds it. Checked rather than
-- trusted because the measurement is scaled back from a bounded raster, and an
-- off-by-one there would quietly report negative padding.
alter table public.brand_materials
  drop constraint if exists materials_trim_within_frame;
alter table public.brand_materials
  add constraint materials_trim_within_frame
  check (
    (trim_width is null or trim_width > 0)
    and (trim_height is null or trim_height > 0)
    and (trim_width is null or width is null or trim_width <= width)
    and (trim_height is null or height is null or trim_height <= height)
  );

comment on column public.brand_materials.ink_ratio is
  'Measured at intake: alpha-weighted coverage inside the artwork''s own bounding box, 0-1. Intrinsic to the artwork — a padded export and its trimmed derivative measure the same. NULL = not measured.';
comment on column public.brand_materials.trim_width is
  'Measured at intake: width of the artwork''s own bounding box in this file''s pixels. Equal to width when the export left no padding. NULL = not measured.';
comment on column public.brand_materials.trim_height is
  'Measured at intake: height of the artwork''s own bounding box in this file''s pixels. NULL = not measured.';

-- The normalisation offer asks one question of the library: which marks carry
-- padding worth cutting. Keeping it cheap matters because the inventory asks it
-- for every row it draws.
create index if not exists brand_materials_padded_idx
  on public.brand_materials (brand_id)
  where trim_width is not null and width is not null and trim_width < width;

-- ---------- verification ---------------------------------------------------

select
  count(*) filter (where ink_ratio is not null)   as measured_ink,
  count(*) filter (where trim_width is not null)  as measured_trim,
  count(*) filter (where trim_width is not null and width is not null
                     and trim_width * trim_height < width * height * 0.9)
                                                  as padded,
  count(*)                                        as total
from public.brand_materials;
