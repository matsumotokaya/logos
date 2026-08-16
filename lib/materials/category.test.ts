import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryFromImageRole,
  isMaterialCategory,
  materialCategoryLabel,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_HINTS,
  MATERIAL_CATEGORY_LABELS,
} from "./category";

test("語彙は1箇所が持つ（ラベルと説明が全値ぶん揃う）", () => {
  for (const category of MATERIAL_CATEGORIES) {
    assert.ok(MATERIAL_CATEGORY_LABELS[category], `${category} のラベルが無い`);
    assert.ok(MATERIAL_CATEGORY_HINTS[category], `${category} の説明が無い`);
  }
  // 逆向き。増やしたときに片方だけ足す事故を止める。
  assert.equal(Object.keys(MATERIAL_CATEGORY_LABELS).length, MATERIAL_CATEGORIES.length);
  assert.equal(Object.keys(MATERIAL_CATEGORY_HINTS).length, MATERIAL_CATEGORIES.length);
});

test("マーケティングに普遍的に要るものが入っている", () => {
  // 動画だけを見て決めると product / screen が落ちる。LP・バナーで必ず要る。
  for (const required of ["person", "product", "screen", "place", "mark"]) {
    assert.ok(
      (MATERIAL_CATEGORIES as readonly string[]).includes(required),
      `${required} が語彙に無い`,
    );
  }
});

test("event-cm の使い道は共通語彙へ翻訳される", () => {
  assert.equal(categoryFromImageRole("speaker-portrait"), "person");
  assert.equal(categoryFromImageRole("venue"), "place");
  assert.equal(categoryFromImageRole("logo"), "mark");
});

test("使い道でしかないものは内容を名乗らない", () => {
  // key-visual は「この動画での主役」であって、写っているものではない。
  // 内容としては情景に落ちる——placement は元の role を読み続ける。
  assert.equal(categoryFromImageRole("key-visual"), "scenery");
  assert.equal(categoryFromImageRole("scene-photo"), "scenery");
});

test("読めなかった画像は other ではなく null", () => {
  // 「見たが何でもなかった」と「分からなかった」を混同しない。
  assert.equal(categoryFromImageRole("unreadable"), null);
  assert.equal(categoryFromImageRole(null), null);
  assert.equal(categoryFromImageRole("知らない語"), null);
});

test("未分類は「未分類」と言う（勝手に その他 にしない）", () => {
  assert.equal(materialCategoryLabel(null), "未分類");
  assert.equal(materialCategoryLabel("person"), "人物の写真");
  assert.equal(materialCategoryLabel("存在しない値"), "未分類");
  assert.equal(isMaterialCategory("other"), true);
  assert.equal(isMaterialCategory("price"), false);
});

test("呼び名がファイルであることを名乗る（情報と読み違えられない）", () => {
  // 「場所」は会場フィールドのことに読めるが、「場所の写真」は読めない。
  // §5 の区別を、仕様書を読んでいない人にも呼び名だけで伝えるため。
  for (const category of ["person", "product", "screen", "place", "scenery"] as const) {
    const label = MATERIAL_CATEGORY_LABELS[category];
    assert.ok(
      label.endsWith("の写真") || label.endsWith("の画像"),
      `${category} の呼び名「${label}」がファイルであることを名乗っていない`,
    );
  }
});
