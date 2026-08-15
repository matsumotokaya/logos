import assert from "node:assert/strict";
import test from "node:test";
import { videoState } from "./asset";

// How far along a video is, asked once for every template.
//
// The list and the detail screen each used to answer this, branching on the
// template id, and they had drifted apart: the list consulted the local job
// file BEFORE the renders, so a product-cm take rendered through the Take
// pipeline read 「未作成」 in the portal and 「MP4あり」 on its own page.

const EVENT = {
  template: "event-cm",
  hasRender: false,
  hasBrief: true,
  hasVoice: false,
};

test("書き出したMP4があれば、どのテンプレートでも「MP4あり」", () => {
  assert.equal(videoState({ ...EVENT, hasRender: true }), "mp4_ready");
  // The case the two screens disagreed on: a rendered product-cm whose local
  // job store knows nothing about it.
  assert.equal(
    videoState({
      template: "product-cm",
      hasRender: true,
      hasBrief: true,
      hasVoice: false,
      campaign: () => "empty",
    }),
    "mp4_ready",
  );
});

test("イベント動画はブリーフだけで再生できる（追加した瞬間から）", () => {
  assert.equal(videoState(EVENT), "preview_ready");
  assert.equal(videoState({ ...EVENT, template: "event-promo" }), "preview_ready");
  assert.equal(videoState({ ...EVENT, hasBrief: false }), "empty");
});

test("製品CMは読み上げが固定されるまで再生できない", () => {
  // The brief is a Brand Kit plus timing; without the recording there is no
  // length, so a player with nothing in it would be the wrong promise.
  const base = {
    template: "product-cm",
    hasRender: false,
    hasBrief: true,
    hasVoice: false,
  };
  assert.equal(videoState(base), "empty");
  assert.equal(videoState({ ...base, hasVoice: true }), "preview_ready");
  // Generated before the voice was pinned onto the take: the job store still
  // answers for it.
  assert.equal(videoState({ ...base, campaign: () => "preview_ready" }), "preview_ready");
});

test("未知のテンプレートは「ブリーフがあれば再生できる」側に倒す", () => {
  // The product's stance, and the safe default: a template that has not
  // declared itself is not assumed to need a recording it may never have.
  assert.equal(videoState({ ...EVENT, template: "future-template" }), "preview_ready");
});
