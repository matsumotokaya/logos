import assert from "node:assert/strict";
import test from "node:test";
import {
  BRAND_ASSET_GOAL,
  brandAssetsPipeline,
  type BrandPipelineInput,
} from "./brand-assets";

const EMPTY: BrandPipelineInput = {
  sources: [],
  extracted: [],
  claims: [],
  adoptedPaths: [],
  logos: [],
};

function stage(input: BrandPipelineInput, id: string) {
  const found = brandAssetsPipeline(input).stages.find((s) => s.id === id);
  assert.ok(found, `${id} stage missing`);
  return found;
}

test("素材が無いブランドは全段が空", () => {
  const { stages } = brandAssetsPipeline(EMPTY);
  assert.deepEqual(
    stages.map((s) => s.status),
    ["empty", "empty", "empty", "empty", "empty"],
  );
});

test("採用済みの項目だけがゴールを満たす", () => {
  const { goal } = brandAssetsPipeline({
    ...EMPTY,
    // A claim that was never adopted must not count: the loop only closes when
    // a value is settled, which is exactly the gap v2 shipped with.
    claims: [
      { fieldPath: "palette.primary", sourceKind: "url_extraction", createdAt: "2026-08-09T00:00:00Z" },
      { fieldPath: "typography.body_font", sourceKind: "url_extraction", createdAt: "2026-08-09T00:00:00Z" },
    ],
    adoptedPaths: ["palette.primary"],
  });
  assert.deepEqual(goal.filled.map((f) => f.path), ["palette.primary"]);
  assert.ok(goal.missing.some((f) => f.path === "typography.body_font"));
});

test("必須項目の不足だけを別に数える", () => {
  const { goal } = brandAssetsPipeline({
    ...EMPTY,
    adoptedPaths: BRAND_ASSET_GOAL.filter((f) => f.required).map((f) => f.path),
  });
  assert.deepEqual(goal.missingRequired, []);
  assert.ok(goal.missing.length > 0, "任意項目は残る");
});

test("素材を足すと下流だけが古くなる", () => {
  const base: BrandPipelineInput = {
    sources: [{ label: "https://example.com", addedAt: "2026-08-01T00:00:00Z" }],
    extracted: [{ kind: "palette", observedAt: "2026-08-01T00:00:00Z" }],
    claims: [
      { fieldPath: "palette.primary", sourceKind: "url_extraction", createdAt: "2026-08-01T00:00:00Z" },
    ],
    adoptedPaths: ["palette.primary"],
    logos: [{ hasImage: true, provisional: true }],
  };
  assert.equal(stage(base, "extract").status, "ready");

  const withNewSource: BrandPipelineInput = {
    ...base,
    sources: [
      ...base.sources,
      { label: "guideline.pdf", addedAt: "2026-08-09T00:00:00Z" },
    ],
  };
  assert.equal(stage(withNewSource, "input").status, "ready", "入力は古くならない");
  assert.equal(stage(withNewSource, "extract").status, "stale");
});

test("マッピングの分母は主張の数ではなくゴールの項目数", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    fieldPath: `noise.${i}`,
    sourceKind: "url_extraction",
    createdAt: "2026-08-09T00:00:00Z",
  }));
  const mapped = stage(
    { ...EMPTY, claims: many, adoptedPaths: ["palette.primary"] },
    "map",
  );
  assert.equal(mapped.summary, `1/${BRAND_ASSET_GOAL.length}項目を採用`);
});
