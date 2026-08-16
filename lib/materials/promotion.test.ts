import assert from "node:assert/strict";
import test from "node:test";
import { isMaterialScope, promotionRefusal, promotionTo } from "./promotion";

test("この動画の素材はブランドの基盤へ上げられる", () => {
  const decision = promotionTo({ scope: "take" }, "brand");
  assert.equal(decision.can, true);
  assert.equal(decision.can && decision.to, "brand");
});

test("スコープは広がるだけ（狭めるのは誰にも許さない）", () => {
  // 0028 のtriggerがそう宣言している。管理者でも同じ——広いスコープに
  // 依存しているTakeが素材を失うため。
  const decision = promotionTo({ scope: "brand" }, "take");
  assert.equal(decision.can, false);
  assert.equal(decision.can === false && decision.reason, "素材のスコープは広げることしかできません");
});

test("すでに基盤にあるものは、そう言って断る", () => {
  const decision = promotionTo({ scope: "brand" }, "brand");
  assert.equal(decision.can, false);
  assert.ok(decision.can === false && decision.reason.includes("すでに"));
});

test("案件に属していない素材は、案件へは上げられない", () => {
  // work スコープは work_id を要求する（0028 の materials_scope_owner）。
  const without = promotionTo({ scope: "take", work_id: null }, "work");
  assert.equal(without.can, false);
  assert.ok(without.can === false && without.reason.includes("案件"));

  const with_ = promotionTo({ scope: "take", work_id: "w-1" }, "work");
  assert.equal(with_.can, true);
});

test("知らないスコープは受け付けない", () => {
  assert.equal(isMaterialScope("brand"), true);
  assert.equal(isMaterialScope("global"), false);
  assert.equal(promotionTo({ scope: "take" }, "global").can, false);
  assert.equal(promotionTo({ scope: "宇宙" }, "brand").can, false);
});

test("権限の断りは、足りない権限を名指しする", () => {
  // RLSは禁止された更新を0行で返すので、断りと不在が同じ形に見える。
  // 「素材が見つかりません」と言うと、人は間違ったものを探しに行く。
  assert.ok(promotionRefusal("brand").includes("管理者"));
  assert.ok(!promotionRefusal("brand").includes("見つかりません"));
});
