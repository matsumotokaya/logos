/**
 * The five stages every deliverable is built through (deliverable-architecture
 * §15.2). These are what the user sees; whatever parallelism or node splitting
 * a stage needs internally stays inside it.
 *
 * A stage is not a screen. The deliverable itself stays on screen and a stage
 * opens over it, so "which stage is open" is a property of the URL rather than
 * a place the app navigates to (§17.3).
 */
export const PIPELINE_STAGES = [
  "input",
  "extract",
  "structure",
  "map",
  "output",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStageId, string> = {
  input: "入力",
  extract: "抽出",
  structure: "構造化",
  map: "マッピング",
  output: "出力",
};

/**
 * `stale` is the whole point of modelling stages at all: adding one source
 * must invalidate what came after it and nothing before it, so the user can
 * keep injecting information without re-running everything (§17.4).
 */
export type PipelineStageStatus = "empty" | "ready" | "stale";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  status: PipelineStageStatus;
  /** One line of fact — counts, never an estimated percentage. */
  summary: string;
  /** When this stage last produced something. */
  producedAt: string | null;
}

/**
 * What a deliverable is trying to become. Goals are the product's standard of
 * value (§17.1): a field is not judged against a reference answer, only
 * against whether the goal is met.
 *
 * `required` fields are what the deliverable cannot be considered complete
 * without. Everything else improves it.
 */
export interface GoalField {
  path: string;
  label: string;
  required: boolean;
}

export interface GoalProgress {
  /** Goal fields that have an adopted value. */
  filled: GoalField[];
  /** Goal fields with nothing adopted yet — the list of things to go get. */
  missing: GoalField[];
  /** Missing fields that are required. */
  missingRequired: GoalField[];
}

export function goalProgress(
  goal: readonly GoalField[],
  filledPaths: Iterable<string>,
): GoalProgress {
  const have = new Set(filledPaths);
  const filled = goal.filter((field) => have.has(field.path));
  const missing = goal.filter((field) => !have.has(field.path));
  return {
    filled,
    missing,
    missingRequired: missing.filter((field) => field.required),
  };
}
