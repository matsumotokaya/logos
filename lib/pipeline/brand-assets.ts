import {
  goalProgress,
  STAGE_LABELS,
  type GoalField,
  type GoalProgress,
  type PipelineStage,
  type PipelineStageStatus,
} from "./stages";

/**
 * What a brand needs before it can dress anything else. This list is the
 * product's opinion, not a schema dump: it says a brand is not understood
 * until we know its colours, its typography, its spacing feel and its mark.
 *
 * Everything downstream reads from here, so adding a row here is how the bar
 * gets raised — the pipeline immediately reports it as missing and the
 * extractors get a new thing to go find (§17.1).
 */
export const BRAND_ASSET_GOAL: readonly GoalField[] = [
  { path: "palette.primary", label: "プライマリカラー", required: true },
  { path: "palette.accent", label: "アクセントカラー", required: true },
  { path: "palette.background", label: "背景色", required: true },
  { path: "palette.surface", label: "面の色", required: false },
  { path: "palette.text", label: "文字色", required: true },
  { path: "palette.mode", label: "明暗", required: false },
  { path: "typography.heading_font", label: "見出し書体", required: true },
  { path: "typography.body_font", label: "本文書体", required: true },
  { path: "typography.font_style", label: "書体の性格", required: false },
  { path: "tokens.button_radius", label: "角の丸み", required: false },
  { path: "tokens.button_padding", label: "ボタンの余白", required: false },
  { path: "tokens.section_spacing", label: "セクション間の余白", required: false },
  { path: "tokens.container_width", label: "コンテナ幅", required: false },
  { path: "tone.theme", label: "トーン", required: false },
];

export interface BrandPipelineInput {
  /** Sources fed in so far: the site URL, uploaded PDFs, guidelines. */
  sources: Array<{ label: string; addedAt: string | null }>;
  /** Raw observations an extractor produced, before any interpretation. */
  extracted: Array<{ kind: string; observedAt: string | null }>;
  /** Claims recorded against this brand, adopted or not. */
  claims: Array<{ fieldPath: string; sourceKind: string; createdAt: string | null }>;
  /** Field paths with an adopted value. */
  adoptedPaths: string[];
  /** Logos that belong to this brand. */
  logos: Array<{ hasImage: boolean; provisional: boolean }>;
}

export interface BrandPipeline {
  stages: PipelineStage[];
  goal: GoalProgress;
}

function latest(times: Array<string | null | undefined>): string | null {
  const valid = times.filter((value): value is string => Boolean(value)).sort();
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

/**
 * A stage is stale when something upstream of it is newer than its own output,
 * **or when that upstream is itself stale**. Staleness has to travel the whole
 * chain: adding one source invalidates extraction, and everything extraction
 * fed is then built on a reading that no longer covers the inputs. Comparing
 * only against the immediate upstream's timestamp stops the signal one stage
 * in, which reads as "the structure is fine" when it is not.
 *
 * Timestamps suffice while each stage writes once per run; content fingerprints
 * become necessary when a stage can re-run without its inputs changing
 * (§16 Phase 2).
 */
function statusFor(
  produced: string | null,
  upstream: string | null,
  hasOutput: boolean,
  upstreamStale: boolean,
): PipelineStageStatus {
  if (!hasOutput) return "empty";
  if (upstreamStale) return "stale";
  if (produced && upstream && upstream > produced) return "stale";
  return "ready";
}

/**
 * Derive the brand-asset pipeline from facts already in the database. Nothing
 * here is stored: a stage's state is a reading of its inputs and outputs, so
 * it cannot drift out of sync with them.
 */
export function brandAssetsPipeline(input: BrandPipelineInput): BrandPipeline {
  const goal = goalProgress(BRAND_ASSET_GOAL, input.adoptedPaths);

  const inputAt = latest(input.sources.map((source) => source.addedAt));
  const extractAt = latest(input.extracted.map((item) => item.observedAt));
  const structureAt = latest(input.claims.map((claim) => claim.createdAt));
  // Adoption has no timestamp of its own in the read model; a claim that is
  // adopted was adopted no earlier than it was made.
  const mapAt = input.adoptedPaths.length > 0 ? structureAt : null;
  const withImage = input.logos.filter((logo) => logo.hasImage);

  const inputStatus: PipelineStageStatus =
    input.sources.length > 0 ? "ready" : "empty";
  const extractStatus = statusFor(
    extractAt,
    inputAt,
    input.extracted.length > 0,
    false,
  );
  const structureStatus = statusFor(
    structureAt,
    extractAt,
    input.claims.length > 0,
    extractStatus === "stale",
  );
  const mapStatus = statusFor(
    mapAt,
    structureAt,
    input.adoptedPaths.length > 0,
    structureStatus === "stale",
  );
  const outputStatus = statusFor(
    mapAt,
    mapAt,
    withImage.length > 0,
    mapStatus === "stale",
  );

  const stages: PipelineStage[] = [
    {
      id: "input",
      label: STAGE_LABELS.input,
      status: inputStatus,
      summary:
        input.sources.length > 0
          ? `${input.sources.length}件の素材`
          : "素材がありません",
      producedAt: inputAt,
    },
    {
      id: "extract",
      label: STAGE_LABELS.extract,
      status: extractStatus,
      summary:
        input.extracted.length > 0
          ? `${input.extracted.length}件を取り出し`
          : "未抽出",
      producedAt: extractAt,
    },
    {
      id: "structure",
      label: STAGE_LABELS.structure,
      status: structureStatus,
      summary:
        input.claims.length > 0
          ? `${input.claims.length}件の主張`
          : "未構造化",
      producedAt: structureAt,
    },
    {
      id: "map",
      label: STAGE_LABELS.map,
      status: mapStatus,
      // The denominator is the goal, not the number of claims: what matters is
      // how much of what a brand needs is settled, not how much was found.
      summary: `${goal.filled.length}/${BRAND_ASSET_GOAL.length}項目を採用`,
      producedAt: mapAt,
    },
    {
      id: "output",
      label: STAGE_LABELS.output,
      status: outputStatus,
      summary:
        withImage.length > 0
          ? `ロゴ${withImage.length}件${
              withImage.some((logo) => logo.provisional) ? "（仮）" : ""
            }`
          : "ロゴがありません",
      producedAt: mapAt,
    },
  ];

  return { stages, goal };
}
