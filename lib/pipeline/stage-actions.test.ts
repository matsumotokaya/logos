import assert from "node:assert/strict";
import test from "node:test";
import { stageActions } from "./stage-actions";
import type { PipelineStage, PipelineStageId, PipelineStageStatus } from "./stages";

/**
 * A pipeline in whatever state the test needs, in chain order.
 *
 * Four stages, not the five of `PIPELINE_STAGES`: the video pipeline merges
 * input and extraction into one drawer (lib/pipeline/video.ts), and the labels
 * are the ones that pipeline gives them — a reason string quotes them.
 */
const LABELS: Partial<Record<PipelineStageId, string>> = {
  input: "入力・抽出",
  structure: "構造化",
  map: "マッピング",
  output: "動画",
};

const pipeline = (
  statuses: Partial<Record<PipelineStageId, PipelineStageStatus>>,
): PipelineStage[] =>
  (["input", "structure", "map", "output"] as PipelineStageId[]).map((id) => ({
    id,
    label: LABELS[id] ?? id,
    status: statuses[id] ?? "empty",
    summary: "",
    producedAt: null,
  }));

const READ = { input: "ready", structure: "ready", map: "ready" } as const;

test("資料が無ければ読み取りは押せず、理由を出す", () => {
  const { own } = stageActions({
    stageId: "input",
    stages: pipeline({}),
    hasMaterial: false,
    filmSteps: [],
  });
  assert.equal(own?.enabled, false);
  assert.equal(own?.reason, "先に資料かテキストを追加してください");
});

test("すべて読み取り済みなら読み取りは押せない", () => {
  const { own } = stageActions({
    stageId: "input",
    stages: pipeline({ input: "ready" }),
    hasMaterial: true,
    filmSteps: [],
  });
  assert.equal(own?.enabled, false);
  assert.equal(own?.reason, "すべて読み取り済みです");
});

test("前の段が古いあいだは次へ進めない", () => {
  // Applying a mapping whose structuring is out of date applies the wrong facts.
  const { advance } = stageActions({
    stageId: "structure",
    stages: pipeline({ input: "ready", structure: "stale" }),
    hasMaterial: true,
    filmSteps: [],
  });
  assert.equal(advance?.enabled, false);
  assert.equal(advance?.reason, "構造化が最新になると実行できます");
});

test("資料が1件も無くても映像の段は押せる", () => {
  // The one rule this file exists for. A seeded take has no documents by design
  // (§9.9) and still has a complete brief, so the narration, the reading aloud
  // and the fixing all have something to work on. `hasMaterial` gates reading.
  const { advance } = stageActions({
    stageId: "map",
    stages: pipeline(READ),
    hasMaterial: false,
    filmSteps: ["narration", "voice", "bake"],
  });
  assert.equal(advance?.run, "film");
  assert.equal(advance?.enabled, true);
  assert.equal(advance?.reason, null);
});

test("映像の段のラベルは、実際にやることを並べる", () => {
  // One fixed label would be wrong whenever only one step is left — and the
  // words are the same ones the badge and the player's notice use (§9.7).
  const label = (steps: Parameters<typeof stageActions>[0]["filmSteps"]) =>
    stageActions({ stageId: "map", stages: pipeline(READ), hasMaterial: true, filmSteps: steps })
      .advance?.label;

  assert.equal(label(["narration", "voice", "bake"]), "ナレーションを書く・読み上げる・動画に反映する");
  assert.equal(label(["bake"]), "動画に反映する");
  assert.equal(label(["voice", "bake"]), "読み上げる・動画に反映する");
});

test("映像が最新なら押せず、段の状態ではなく残り工程で判定する", () => {
  // A film can be fixed and still owe work: a recording the narration has outrun
  // is not a stale stage, it is a step nobody has taken. So the answer comes
  // from the pending steps, never from `output.status`.
  const fixed = stageActions({
    stageId: "map",
    stages: pipeline({ ...READ, output: "ready" }),
    hasMaterial: true,
    filmSteps: [],
  });
  assert.equal(fixed.advance?.enabled, false);
  assert.equal(fixed.advance?.reason, "この動画に反映済みです");

  const owesVoice = stageActions({
    stageId: "map",
    stages: pipeline({ ...READ, output: "ready" }),
    hasMaterial: true,
    filmSteps: ["voice", "bake"],
  });
  assert.equal(owesVoice.advance?.enabled, true, "焼き済みでも読み上げが残れば押せる");
});

test("焼き付けを持たないテンプレートのマッピング段はボタンを出さない", () => {
  // product-cm / event-promo end at the mapping. A button that would call
  // nothing is worse than no button.
  const actions = stageActions({
    stageId: "map",
    stages: pipeline(READ),
    hasMaterial: true,
    filmSteps: null,
  });
  assert.equal(actions.advance, null);
  assert.equal(actions.own, null);
});

test("マッピングが古いあいだは映像にできない", () => {
  // Fixing a film whose facts have not been applied fixes the wrong film.
  const { advance } = stageActions({
    stageId: "map",
    stages: pipeline({ input: "ready", structure: "ready", map: "stale" }),
    hasMaterial: true,
    filmSteps: ["bake"],
  });
  assert.equal(advance?.enabled, false);
  assert.equal(advance?.reason, "マッピングが最新になると実行できます");
});

test("最後の段自身はボタンを持たない", () => {
  // Every drawer offers the step OUT of it; the last one has nowhere to go.
  // Re-running a finished film is the page-level button's job.
  const actions = stageActions({
    stageId: "output",
    stages: pipeline({ ...READ, output: "ready" }),
    hasMaterial: true,
    filmSteps: [],
  });
  assert.equal(actions.own, null);
  assert.equal(actions.advance, null);
});
