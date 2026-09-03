import assert from "node:assert/strict";
import test from "node:test";
import { resolveSubjectCategory } from "./classification";

test("分類が返したカテゴリーをそのまま採る", () => {
  assert.deepEqual(
    resolveSubjectCategory({
      brand_kind: "product",
      placement: "brand",
      confidence: "high",
      rationale: "独自ロゴがある",
    }),
    { brandKind: "product", confidence: "high" },
  );
});

test("placementはもう読まない（v3でBrandは常に1つ立つ）", () => {
  // 旧モデルでは placement=work が「Brandを作らない」を意味した。
  assert.deepEqual(
    resolveSubjectCategory({
      brand_kind: "event",
      placement: "work",
      confidence: "medium",
      rationale: "単開催のセミナー",
    }),
    { brandKind: "event", confidence: "medium" },
  );
});

test("分類が無ければ旧スコープから最小限を埋める", () => {
  assert.deepEqual(resolveSubjectCategory(undefined, "organization"), {
    brandKind: "corporate",
    confidence: "low",
  });
  assert.deepEqual(resolveSubjectCategory(undefined, "business"), {
    brandKind: "business",
    confidence: "low",
  });
});
