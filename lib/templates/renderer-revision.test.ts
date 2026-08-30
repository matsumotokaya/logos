// What makes an exported file old.
//
// `rendererRevision` was declared, written to the ledger, and read by nothing:
// the only thing that could make an MP4 look stale was a newer bake, so fixing
// the drawing left every existing export silently wrong — the player ran the
// new composition and the file did not. These say what the comparison may and
// may not claim.

import assert from "node:assert/strict";
import test from "node:test";
import {
  currentTemplate,
  rendererChangedSince,
  rendererRevisionOf,
} from "./catalog";

const EVENT_CM = "event-cm";
const current = () => currentTemplate(EVENT_CM)?.rendererRevision ?? "";

test("同じ版で描かれたファイルは古くない", () => {
  assert.equal(rendererChangedSince(current(), EVENT_CM), false);
});

test("別の版で描かれたファイルは古い", () => {
  assert.equal(rendererChangedSince("remotion/event-cm@2020-01-01", EVENT_CM), true);
});

test("版が記録されていないファイルについては古いと言わない", () => {
  // Everything exported before this was recorded. Claiming they are stale would
  // put an amber box on every existing video once, permanently, on no evidence.
  for (const unknown of [null, undefined, "", 42, {}]) {
    assert.equal(rendererChangedSince(unknown, EVENT_CM), false);
  }
});

test("知らないテンプレートについては古いと言わない", () => {
  assert.equal(rendererChangedSince("anything", "no-such-template"), false);
});

test("記録される版は、そのテンプレートが今名乗っている版", () => {
  assert.equal(rendererRevisionOf(EVENT_CM), current());
  assert.equal(rendererRevisionOf("no-such-template"), null);
});
