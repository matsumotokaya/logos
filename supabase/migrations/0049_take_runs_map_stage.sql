-- ============================================================================
-- 0049 - allow a `map` run on take_runs
--
-- The five stages the product shows are 入力 / 抽出 / 構造化 / マッピング / 出力
-- (lib/pipeline/stages.ts), but take_runs only allowed
-- collect / extract / structure / render / publish. Mapping had nowhere to
-- record itself, so the structuring run had to both read the material AND
-- write the result into the brief — which left the マッピング stage with
-- nothing a person could run, and its drawer with nothing to offer.
--
-- Splitting them is what makes each stage's drawer carry exactly one action:
-- 入力→読み取る, 抽出→構造化する, 構造化→動画へ反映する.
--
-- Widening a CHECK constraint only: no existing row can violate the new set,
-- and no column changes.
-- ============================================================================

alter table public.take_runs
  drop constraint if exists take_runs_stage_check;

alter table public.take_runs
  add constraint take_runs_stage_check
  check (stage = any (array[
    'collect'::text,
    'extract'::text,
    'structure'::text,
    'map'::text,
    'render'::text,
    'publish'::text
  ]));
