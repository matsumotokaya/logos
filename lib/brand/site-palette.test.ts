import assert from "node:assert/strict";
import test from "node:test";
import { assignPaletteRoles, readsAsDifferentColor } from "./site-palette";

/** What wealthpark-lab.com actually renders (captured 2026-08-11). */
const MONOCHROME_SITE = {
  logoColors: ["#080808"],
  interactive: [
    { hex: "#000000", count: 30 },
    { hex: "#cccccc", count: 11 },
    { hex: "#ffffff", count: 9 },
    { hex: "#007aff", count: 2 },
  ],
  backgrounds: ["#ffffff", "#f7f7f7", "#000000", "#333333"],
  texts: ["#000000", "#ffffff", "#666666"],
  // Both are WordPress stock colours: present in the markup, painted on no
  // pixel of the rendered page. #abb8c3 is not even grey enough to be caught
  // by a grey filter (max channel spread 24).
  hints: ["#32373c", "#abb8c3"],
};

test("CMSの既定色をアクセントとして採用しない", () => {
  const palette = assignPaletteRoles(MONOCHROME_SITE);
  assert.equal(palette.accent, undefined);
});

test("マークアップにしか無い色はアクセントにならない", () => {
  // Painted on the page is the requirement, not "mentioned in the stylesheet".
  const palette = assignPaletteRoles({
    logoColors: ["#101010"],
    interactive: [{ hex: "#000000", count: 30 }],
    backgrounds: ["#ffffff"],
    texts: ["#101010"],
    hints: ["#e11d48"],
  });

  assert.equal(palette.accent, undefined);
});

test("モノクロのブランドにはアクセントを作らない", () => {
  // #cccccc は罫線の色、#007aff は未装飾リンクのブラウザ既定色。どちらも
  // 「強調のために選ばれた色」ではないので、アクセントとして記録すると
  // 下流のレンダラーが在りもしない強調色を使おうとする。
  const palette = assignPaletteRoles(MONOCHROME_SITE);

  assert.equal(palette.primary, "#080808");
  assert.equal(palette.accent, undefined);
  assert.equal(palette.background, "#ffffff");
  assert.equal(palette.surface, "#f7f7f7");
  assert.equal(palette.text, "#000000");
});

test("見分けのつかない色をアクセントとして記録しない", () => {
  assert.equal(readsAsDifferentColor("#080808", "#000000"), false);
});

test("暗い色どうしはRGB距離で離れていても同じ色として扱う", () => {
  // Euclidean distance 29 — but 1.11 contrast. Both read as black.
  assert.equal(readsAsDifferentColor("#111111", "#000000"), false);
});

test("明るさが同じでも色相が違えば別の色として扱う", () => {
  // Contrast 1.00, so lightness alone would merge them.
  assert.equal(readsAsDifferentColor("#0000ff", "#4d4d4d"), true);
});

test("十分に使われている有彩色はアクセントになる", () => {
  const palette = assignPaletteRoles({
    logoColors: ["#101010"],
    interactive: [
      { hex: "#000000", count: 20 },
      { hex: "#e11d48", count: 7 },
    ],
    backgrounds: ["#ffffff"],
    texts: ["#101010"],
    hints: [],
  });

  assert.equal(palette.accent, "#e11d48");
});

test("ページが実際に塗っている有彩色をアクセントにする", () => {
  const palette = assignPaletteRoles({
    logoColors: ["#101010"],
    interactive: [{ hex: "#0f766e", count: 9 }],
    backgrounds: ["#ffffff"],
    texts: ["#101010"],
    hints: ["#e11d48"],
  });

  assert.equal(palette.accent, "#0f766e");
});

test("面の色は背景のわずかな差でよい（アクセントの基準を当てない）", () => {
  const palette = assignPaletteRoles({
    logoColors: ["#2563eb"],
    interactive: [{ hex: "#2563eb", count: 12 }],
    backgrounds: ["#ffffff", "#fdfdfd"],
    texts: ["#111827"],
    hints: [],
  });

  assert.equal(palette.surface, "#fdfdfd");
});

test("背景が1色しか無ければ surface は背景に落ちる", () => {
  const palette = assignPaletteRoles({
    logoColors: ["#2563eb"],
    interactive: [{ hex: "#2563eb", count: 12 }],
    backgrounds: ["#ffffff"],
    texts: ["#111827"],
    hints: [],
  });

  assert.equal(palette.surface, "#ffffff");
});

test("証拠が何も無ければ空を返す", () => {
  assert.deepEqual(
    assignPaletteRoles({
      logoColors: [],
      interactive: [],
      backgrounds: [],
      texts: [],
      hints: [],
    }),
    {},
  );
});
