/**
 * The five-stage pipeline for one V2 video Take.
 *
 * The same five stages as the brand-asset pipeline (deliverable-architecture
 * §15.2), but the inputs and outputs are read from rows the video product
 * already has — `takes` (brief), `take_renders` (status), `render_artifacts`
 * (MP4). Nothing here is stored: each stage is a read of its inputs and
 * outputs, so it cannot drift.
 *
 * Stage definitions stay close to the brand-asset ones (lib/pipeline/brand-
 * assets.ts). The point of staging is to give the user one mental model
 * across surfaces; if the video pipeline quietly renamed "map" to "render"
 * the metaphor would stop paying off.
 */

import type { EventBrief } from "@/remotion/event/types";
import {
  STAGE_LABELS,
  goalProgress,
  type GoalField,
  type GoalProgress,
  type PipelineStage,
  type PipelineStageStatus,
} from "./stages";

/**
 * What an event-promo brief needs before its output is anything but a shell.
 * Listed as a goal so the bar is the same one the user sees on the bar: a
 * missing field is a task to go pick up, not a debug log.
 *
 * product-cm has its own brief shape (see lib/templates/brief-schemas), and
 * it is run through a different goal — a single product-cm field (the voice
 * track) gates the rest of the pipeline, so it would be misleading to grade
 * it against the same checklist.
 */
export const EVENT_BRIEF_GOAL: readonly GoalField[] = [
  { path: "title", label: "タイトル", required: true },
  { path: "kind", label: "イベント種別", required: true },
  { path: "startsAt", label: "開始日時", required: true },
  { path: "venue", label: "会場", required: true },
  { path: "headline", label: "見出しコピー", required: true },
  { path: "body", label: "本文コピー", required: false },
  { path: "ctaLabel", label: "CTAラベル", required: true },
  { path: "visualBrief", label: "ビジュアル指示", required: false },
];

/**
 * product-cm's brief is small enough that the goal is implicit: a pinned voice
 * track means the CM Take is self-contained and can be rendered. Anything else
 * is the narration workspace's problem, not a "missing field" on the pipeline.
 */
export const PRODUCT_CM_BRIEF_GOAL: readonly GoalField[] = [
  { path: "voice.track", label: "音声トラック", required: true },
];

export interface VideoPipelineInput {
  template: "event-promo" | "product-cm" | string;
  hasBrief: boolean;
  /** Materials the user actually supplied, pinned to this take. */
  sourceCount?: number;
  /** When the newest of them was pinned. */
  sourcePinnedAt?: string | null;
  /** Last successful run per stage, when there has been one. */
  runs?: Partial<Record<"extract" | "structure" | "map", string | null>>;
  /** When the brief was last written. */
  briefUpdatedAt: string | null;
  /** Resolved brief payload (or whatever the take currently holds). */
  brief: Record<string, unknown> | null;
  /** Render job status, when one exists. */
  renderStatus: "running" | "ready" | "failed" | "empty";
  /** When the render was last produced (successful or attempted). */
  renderUpdatedAt: string | null;
  /** When the most recent MP4 artifact was uploaded. */
  artifactCreatedAt: string | null;
}

export interface VideoPipeline {
  stages: PipelineStage[];
  goal: GoalProgress;
}

/** Pick the right goal for the template — the same pipeline shape, different
 * checklists. */
function goalFor(template: string): readonly GoalField[] {
  if (template === "event-promo") return EVENT_BRIEF_GOAL;
  if (template === "product-cm") return PRODUCT_CM_BRIEF_GOAL;
  return [];
}

/** Field paths that are actually populated in the current brief. */
function filledPaths(brief: Record<string, unknown> | null): string[] {
  if (!brief) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(brief)) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "object" && Object.keys(value as object).length === 0) continue;
    out.push(key);
  }
  return out;
}

/**
 * Staleness travels: if any upstream is newer than a stage's output, or if
 * the upstream itself is stale, the stage is stale. Same rule as brand-asset
 * pipeline; timestamps suffice while each stage writes once per run.
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

/** Helper retained for future stages that will have multiple upstream rows. */
export function latest(times: Array<string | null | undefined>): string | null {
  const valid = times.filter((value): value is string => Boolean(value)).sort();
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

/**
 * Derive the video pipeline from the rows the video product already keeps.
 * Read-only — the only way a stage gets out of sync is if the rows do.
 */
export function videoPipeline(input: VideoPipelineInput): VideoPipeline {
  const goal = goalProgress(goalFor(input.template), filledPaths(input.brief));

  // input: material the USER supplied — not the brief.
  //
  // This used to read `hasBrief`, which meant every take reported its input
  // stage complete the moment it was created, because a seeded take is created
  // with a brief. That said somebody had given us something when they had
  // given us nothing. A seeded brief is the tool's proposal; the input stage
  // is about what came in from outside.
  const sourceCount = input.sourceCount ?? 0;
  const inputAt = input.sourcePinnedAt ?? null;
  const inputStatus: PipelineStageStatus = sourceCount > 0 ? "ready" : "empty";

  // extract: a run of the extraction stage. Stale once material was added
  // after the last run, which is what makes "add a flyer" visibly change the
  // state of the stages below it.
  const extractAt = input.runs?.extract ?? null;
  const extractStatus = statusFor(extractAt, inputAt, Boolean(extractAt), false);

  // structure: a run that worked out the event's facts from what was read.
  // Recorded, not applied — applying is the map stage's job, which is what
  // gives that stage something a person can actually run.
  const structureAt = input.runs?.structure ?? null;
  const structureStatus = statusFor(
    structureAt,
    extractAt ?? inputAt,
    Boolean(structureAt),
    extractStatus === "stale",
  );

  // map: the brief as it now stands — what the template renders from. It has
  // an output as soon as the take has a brief, because a seeded take is a
  // complete film from the first second; what changes is where its values came
  // from. Its timestamp is the map run when there has been one, and otherwise
  // the brief's own, so a hand-corrected value still counts as work done.
  const mapAt = input.runs?.map ?? input.briefUpdatedAt;
  const mapHasOutput = input.hasBrief && Boolean(input.template);
  const mapStatus = statusFor(
    mapAt,
    structureAt,
    mapHasOutput,
    structureStatus === "stale",
  );

  // output: a Render exists for the take. The MP4 is the timestamp we surface.
  // A failed render still counts as "the stage produced something" — the user
  // can see it failed from the bar dot, but the row exists and the latest
  // attempt is what would be re-rendered.
  const outputAt = input.artifactCreatedAt ?? input.renderUpdatedAt;
  const outputHasOutput = input.renderStatus !== "empty";
  const outputStatus = statusFor(
    outputAt,
    mapAt,
    outputHasOutput,
    mapStatus === "stale",
  );

  const templateLabel =
    input.template === "event-promo"
      ? "Event Promo"
      : input.template === "product-cm"
        ? "Product CM"
        : input.template || "テンプレート未選択";

  const stages: PipelineStage[] = [
    {
      id: "input",
      label: STAGE_LABELS.input,
      status: inputStatus,
      summary:
        sourceCount > 0 ? `資料${sourceCount}件` : "資料なし（すべてこちらの提案）",
      producedAt: inputAt,
    },
    {
      id: "extract",
      label: STAGE_LABELS.extract,
      status: extractStatus,
      summary: extractAt ? "資料を読み取り済み" : "未実行",
      producedAt: extractAt,
    },
    {
      id: "structure",
      label: STAGE_LABELS.structure,
      status: structureStatus,
      summary: structureAt ? "資料の内容を反映済み" : "未実行",
      producedAt: structureAt,
    },
    {
      id: "map",
      label: STAGE_LABELS.map,
      status: mapStatus,
      summary:
        goal.missing.length === 0
          ? `テンプレート: ${templateLabel}`
          : `${goal.filled.length}/${goal.filled.length + goal.missing.length}項目を充足`,
      producedAt: mapAt,
    },
    {
      id: "output",
      label: STAGE_LABELS.output,
      status: outputStatus,
      summary:
        input.renderStatus === "ready"
          ? "MP4を作成済み"
          : input.renderStatus === "running"
            ? "MP4を作成中"
            : input.renderStatus === "failed"
              ? "前回の作成に失敗"
              : "MP4未作成",
      producedAt: outputAt,
    },
  ];

  return { stages, goal };
}

/** Re-export so consumers can import the event-brief shape through this file. */
export type { EventBrief };