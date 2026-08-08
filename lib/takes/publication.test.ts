import assert from "node:assert/strict";
import test from "node:test";
import { canonicalTakePath, canonicalVideoPath } from "./publication-path";

test("Take IDから所有者に依存しないcanonical LP pathを作る", () => {
  assert.equal(
    canonicalTakePath("9ba75cb7-7d29-4ae8-a83b-452e55d13831"),
    "/c/9ba75cb7-7d29-4ae8-a83b-452e55d13831",
  );
});

test("動画TakeはLPと衝突しないcanonical pathを使う", () => {
  assert.equal(
    canonicalVideoPath("9ba75cb7-7d29-4ae8-a83b-452e55d13831"),
    "/v/9ba75cb7-7d29-4ae8-a83b-452e55d13831",
  );
});
