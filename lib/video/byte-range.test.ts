import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange } from "./byte-range";

test("動画プレイヤーの通常Rangeを解釈する", () => {
  assert.deepEqual(parseByteRange("bytes=100-199", 1000), {
    kind: "range",
    start: 100,
    end: 199,
  });
  assert.deepEqual(parseByteRange("bytes=900-", 1000), {
    kind: "range",
    start: 900,
    end: 999,
  });
});

test("suffix Rangeは末尾から数える", () => {
  assert.deepEqual(parseByteRange("bytes=-100", 1000), {
    kind: "range",
    start: 900,
    end: 999,
  });
  assert.deepEqual(parseByteRange("bytes=-2000", 1000), {
    kind: "range",
    start: 0,
    end: 999,
  });
});

test("複数Rangeと範囲外は拒否する", () => {
  assert.deepEqual(parseByteRange("bytes=0-1,4-5", 1000), { kind: "invalid" });
  assert.deepEqual(parseByteRange("bytes=1000-", 1000), { kind: "invalid" });
  assert.deepEqual(parseByteRange("bytes=-0", 1000), { kind: "invalid" });
});
