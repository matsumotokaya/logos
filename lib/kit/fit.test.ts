import assert from "node:assert/strict";
import test from "node:test";
import { fitComponent, fitScene, measure } from "@/remotion/kit/fit";
import { SUMI_THEME, themeForBrand } from "@/remotion/kit/theme";
import { EMPTY_BEHAVIOUR, isEmpty, type SceneComponent } from "@/remotion/kit/components";

const heading = (text: string): SceneComponent => ({ kind: "heading", text });

test("全角と半角を区別して幅を測る", () => {
  assert.equal(measure("あいうえお"), 5);
  assert.equal(measure("ABCDE"), 2.5);
  assert.equal(measure("  あい  "), 2, "前後の空白は数えない");
});

test("短い見出しは要求どおりの大きさで組まれる", () => {
  const fit = fitComponent(heading("金融教育を、じっくり考える夜"), SUMI_THEME);
  assert.equal(fit.kind, "fits");
  assert.equal(fit.kind === "fits" && fit.emphasis, "hero");
  assert.equal(fit.kind === "fits" && fit.steppedDown, 0);
});

test("長い見出しは溢れさせずに一段小さく組む", () => {
  // Sloppy input is the normal case, and it must still come out designed.
  const fit = fitComponent(
    heading("これからの資産形成と文化資本について長い時間をかけて考えるための特別な夜のご案内"),
    SUMI_THEME,
  );
  assert.equal(fit.kind, "fits");
  assert.ok(fit.kind === "fits" && fit.steppedDown > 0, "段を下げて収める");
});

test("二段下げても収まらないものは黙って溢れさせず、収まらないと言う", () => {
  const fit = fitComponent(heading("あ".repeat(2000)), SUMI_THEME);
  assert.equal(fit.kind, "overflows");
});

test("空の部品は常に収まる（設計済みの代替か、退場するため）", () => {
  const fit = fitComponent({ kind: "image", photo: null }, SUMI_THEME);
  assert.equal(fit.kind, "fits");
  assert.equal(EMPTY_BEHAVIOUR.image.mode, "substitute");
  assert.equal(isEmpty({ kind: "image", photo: null }), true);
});

test("事実の空欄は代替を描かず退場する", () => {
  // A venue nobody confirmed leaves the screen; it does not become "未定".
  assert.equal(EMPTY_BEHAVIOUR.datetime.mode, "omit");
  assert.equal(EMPTY_BEHAVIOUR.cta.mode, "omit");
  // A missing portrait is a different thing: the template has a design for it.
  assert.equal(EMPTY_BEHAVIOUR.person.mode, "substitute");
});

test("1シーンに主役は1つだけ。2つ目は降格する", () => {
  const scene = fitScene(
    [heading("世界が恋する日本酒"), heading("文化資本への投資")],
    SUMI_THEME,
  );
  assert.equal(scene.placed.length, 2);
  assert.equal(scene.placed[0].emphasis, "hero");
  assert.notEqual(scene.placed[1].emphasis, "hero", "2つ目は主役にならない");
});

test("収まらない部品は落とされ、落としたことが報告される", () => {
  const scene = fitScene(
    [heading("投資の本質"), { kind: "body", text: "あ".repeat(3000) }],
    SUMI_THEME,
  );
  assert.equal(scene.placed.length, 1);
  assert.equal(scene.dropped.length, 1);
  assert.equal(scene.clean, false, "黙って完璧なふりをしない");
});

test("ブランドから継ぐのは色だけ。組版はテンプレートのもの", () => {
  // The LP templates' rule arriving at video (2026-08-18): what should change
  // per customer is the colour, never the typesetting. The brand gothic on the
  // sake film was the first thing that broke the art direction.
  const themed = themeForBrand(SUMI_THEME, {
    headingFont: "Zen Kaku Gothic New",
    bodyFont: "Zen Kaku Gothic New",
    palette: { accent: "#e11d48" },
  });
  assert.equal(themed.displayFont, SUMI_THEME.displayFont, "見出しの書体は据え置き");
  assert.equal(themed.textFont, SUMI_THEME.textFont, "本文の書体は据え置き");
  assert.equal(themed.palette.accent, "#e11d48");
  assert.equal(themed.palette.ground, SUMI_THEME.palette.ground, "地はテーマのもの");
});

test("アクセントを持たないブランドはテーマの色を保つ", () => {
  // WealthPark Lab has no accent — a real answer, not a gap. The theme keeps
  // its gold, and the caller records that as the tool's proposal.
  const themed = themeForBrand(SUMI_THEME, {
    headingFont: "Zen Kaku Gothic New",
    bodyFont: "Zen Kaku Gothic New",
    palette: { primary: "#080808", background: "#ffffff", text: "#000000" },
  });
  assert.equal(themed.palette.accent, SUMI_THEME.palette.accent);
});
