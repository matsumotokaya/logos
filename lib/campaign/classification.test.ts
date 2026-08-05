import assert from "node:assert/strict";
import test from "node:test";
import { resolveSubjectPlacement } from "./classification";

test("独自ブランドを持つ製品はproduct Brandになる", () => {
  assert.deepEqual(
    resolveSubjectPlacement({
      brand_kind: "product",
      placement: "brand",
      confidence: "high",
      rationale: "独自ロゴがある",
    }),
    { brandKind: "product", placement: "brand", confidence: "high" },
  );
});

test("単発イベントは親Brand配下のWorkになる", () => {
  assert.deepEqual(
    resolveSubjectPlacement({
      brand_kind: "event",
      placement: "work",
      confidence: "medium",
      rationale: "単開催のセミナー",
    }),
    { brandKind: "event", placement: "work", confidence: "medium" },
  );
});

test("corporateとWorkの矛盾はBrandへ正規化する", () => {
  assert.deepEqual(
    resolveSubjectPlacement({
      brand_kind: "corporate",
      placement: "work",
      confidence: "low",
      rationale: "分類が矛盾",
    }),
    { brandKind: "corporate", placement: "brand", confidence: "low" },
  );
});

test("削除前のダイアログで作ったジョブも読める", () => {
  assert.deepEqual(resolveSubjectPlacement(undefined, "organization"), {
    brandKind: "corporate",
    placement: "brand",
    confidence: "low",
  });
});
