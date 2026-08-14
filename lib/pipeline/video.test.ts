import assert from "node:assert/strict";
import test from "node:test";
import { videoPipeline, type VideoPipelineInput } from "./video";

const BASE: VideoPipelineInput = {
  template: "event-cm",
  hasBrief: true,
  sourceCount: 1,
  sourcePinnedAt: "2026-08-14T09:00:00Z",
  runs: {
    extract: "2026-08-14T09:10:00Z",
    structure: "2026-08-14T09:20:00Z",
    map: "2026-08-14T09:30:00Z",
  },
  briefUpdatedAt: "2026-08-14T09:30:00Z",
  brief: { title: "イベント" },
  renderStatus: "empty",
  renderUpdatedAt: null,
  artifactCreatedAt: null,
};

const lastStage = (input: VideoPipelineInput) => {
  const stage = videoPipeline(input).stages.find((item) => item.id === "output");
  assert.ok(stage, "最終段が無い");
  return stage;
};

test("焼き付けを持つテンプレートでは、最終段はMP4ではなく動画", () => {
  const stage = lastStage({ ...BASE, bake: { at: "2026-08-14T10:00:00Z", changes: 0 } });
  assert.equal(stage.label, "動画");
  assert.equal(stage.status, "ready");
  assert.match(stage.summary, /反映済み/);
  // The chain's last dot must not go green or red because of a file nobody
  // asked for (§9.4): there is no MP4 here at all.
  assert.equal(stage.producedAt, "2026-08-14T10:00:00Z");
});

test("一度も実行していなければ空。MP4の有無は関係しない", () => {
  const stage = lastStage({
    ...BASE,
    bake: { at: null, changes: 0 },
    renderStatus: "ready",
    artifactCreatedAt: "2026-08-14T11:00:00Z",
  });
  assert.equal(stage.status, "empty");
  assert.match(stage.summary, /下書き/);
});

test("絵コンテに未反映の変更があれば stale で、件数を言う", () => {
  const stage = lastStage({ ...BASE, bake: { at: "2026-08-14T10:00:00Z", changes: 2 } });
  assert.equal(stage.status, "stale");
  assert.match(stage.summary, /2件/);
});

test("上流が古ければ、焼き付け済みでも古い", () => {
  const stage = lastStage({
    ...BASE,
    // Read again after the last time it was applied: the mapping stage goes
    // stale, and staleness travels to the end of the chain even though the
    // fixed copy is newer than everything.
    runs: {
      extract: "2026-08-14T09:10:00Z",
      structure: "2026-08-14T09:40:00Z",
      map: "2026-08-14T09:30:00Z",
    },
    bake: { at: "2026-08-14T10:00:00Z", changes: 0 },
  });
  assert.equal(stage.status, "stale");
});

test("焼き付けを持たないテンプレートは、これまでどおりMP4のまま", () => {
  const stage = lastStage({
    ...BASE,
    template: "event-promo",
    renderStatus: "ready",
    artifactCreatedAt: "2026-08-14T10:00:00Z",
  });
  assert.equal(stage.label, "出力");
  assert.match(stage.summary, /MP4/);
  assert.equal(stage.status, "ready");
});
