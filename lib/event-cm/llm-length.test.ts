import assert from "node:assert/strict";
import test from "node:test";
import { LengthFinishReasonError } from "openai/error";
import { parseOrExplain } from "./llm-length";

// The failure a user actually met: the map stage stopped after 28 seconds with
// 「Could not parse response content as the length limit was reached」, which
// names no limit, no cause and no remedy — and reads like a broken tool rather
// than a job that outgrew its budget. The reasonable guess it invited (that
// editing while building had corrupted the video, and starting over would fix
// it) is wrong: the same documents hit the same wall.

test("長さ切れは、原因と次の一手が分かる日本語になる", () => {
  assert.rejects(
    () =>
      parseOrExplain(() => {
        throw new LengthFinishReasonError();
      }, "資料が長さの上限に達しました。1回に読む資料を減らしてください"),
    /資料が長さの上限に達しました/,
  );
});

test("それ以外の失敗はそのまま通す（言い換えて隠さない）", () => {
  // A timeout, a 500, a refusal — each has its own message and each needs to
  // reach the run log unchanged. Translating everything into one sentence would
  // make every failure look like the same failure.
  assert.rejects(
    () =>
      parseOrExplain(() => {
        throw new Error("529 overloaded");
      }, "長さの上限"),
    /529 overloaded/,
  );
});
