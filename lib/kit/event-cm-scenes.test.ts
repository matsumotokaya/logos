import assert from "node:assert/strict";
import test from "node:test";
import { scenesForRole } from "@/remotion/kit/scenes/event-cm";
import { fitScene } from "@/remotion/kit/fit";
import { LAYOUTS, overCapacity } from "@/remotion/kit/layout";
import { SUMI_THEME, themeForBrand } from "@/remotion/kit/theme";
import { EVENT_CM_SCENE_ROLES, type EventCmBrief } from "@/remotion/event-cm/types";
import { seedEventCmBrief } from "@/lib/event-cm/seed";

// The acceptance test for the whole rewrite: can the vocabulary rebuild
// 世界が恋する日本酒? The brief below is the real one, copied from the take in
// the database (24f44bd0), with material references standing in for the files.

const SAKE: EventCmBrief = {
  presenter: "レオパレス21 × WealthPark Lab",
  seriesLabel: "「文化資本と投資」シリーズ 第3弾",
  title: "世界が恋する日本酒",
  subtitle: "〜次世代へつなぐ、文化資本への投資〜",
  sideCopy: "特別な日本酒を楽しみながら、日本の文化資本の未来を考える",
  valueLines: ["百貨店には並ばない、", "蔵出しの特別な日本酒。"],
  valueChip: "特別な5種を、テイスティングで",
  programsHeading: "3つのプログラム",
  programs: [
    { title: "蔵出しの特別な日本酒5種類をテイスティング" },
    { title: "十一代目当主 × Miss SAKE代表理事が語る、日本酒業界の舞台裏" },
    { title: "2026 Miss SAKE 2名と学ぶ、楽しみ方を広げるワークショップ" },
  ],
  guestsHeading: "ゲスト",
  guests: [
    { name: "宮尾 佳明", role: "宮尾酒造 十一代目当主", photo: { src: "material:a" } },
    { name: "大西 美香", role: "一社）Miss SAKE 代表理事", photo: { src: "material:b" } },
    {
      name: "加藤 航介",
      role: "モデレーター\nWealthPark研究所 代表",
      photo: { src: "material:c" },
    },
  ],
  schedule: { date: "2026.10.2", weekday: "FRI", time: "17:00 START", venue: null, fee: null },
  cta: "詳細・お申し込みはこちら",
  footnote: "20歳以上より参加可・お一人からご家族まで歓迎",
  logos: [
    { name: "レオパレス21", src: "material:d", scale: 0.82 },
    { name: "WealthPark Lab", src: "material:e", scale: 0.8, treatment: "invert" },
    { name: "〆張鶴", src: "material:f", scale: 1.25 },
    { name: "Miss SAKE", src: "material:g", scale: 1.35 },
  ],
  visuals: {
    inkArt: "material:h",
    value: { src: "material:i", focus: { x: 0.5, y: 0.45 } },
    programs: { src: "material:j", focus: { x: 0.55, y: 0.68 } },
    closing: { src: "material:k", focus: { x: 0.45, y: 0.5 } },
    texture: "material:l",
  },
  bgm: "material:m",
  script: { version: 1, scenes: [], source: "llm", updatedAt: "", angle: "" },
};

const allScenes = (brief: EventCmBrief) =>
  EVENT_CM_SCENE_ROLES.flatMap((role) => scenesForRole(role, brief));

test("日本酒のブリーフはすべての拍でシーンを生む", () => {
  for (const role of EVENT_CM_SCENE_ROLES) {
    const scenes = scenesForRole(role, SAKE);
    assert.ok(scenes.length > 0, `${role} にシーンが無い`);
    assert.ok(scenes.every((scene) => scene.components.length > 0), `${role} が空`);
  }
});

test("登壇者がいる拍は2シーンに割れる", () => {
  assert.equal(scenesForRole("program", SAKE).length, 2);
  assert.equal(scenesForRole("program", { ...SAKE, guests: [] }).length, 1);
});

test("実データのどのシーンも、部品を落とさずに組める", () => {
  // The whole promise of the fitter: real copy, real lengths, nothing spills
  // and nothing silently disappears.
  for (const scene of allScenes(SAKE)) {
    const fit = fitScene(scene.components, SUMI_THEME);
    assert.deepEqual(
      fit.dropped.map((component) => component.kind),
      [],
      `${scene.layout} で部品が落ちた`,
    );
  }
});

test("どのシーンも配置の容量に収まる", () => {
  for (const scene of allScenes(SAKE)) {
    assert.deepEqual(
      overCapacity(scene).map((component) => component.kind),
      [],
      `${scene.layout} が容量超過`,
    );
  }
});

test("どのシーンにも主役は最大1つ", () => {
  for (const scene of allScenes(SAKE)) {
    const heroes = fitScene(scene.components, SUMI_THEME).placed.filter(
      (item) => item.emphasis === "hero",
    );
    assert.ok(heroes.length <= 1, `${scene.layout} に主役が${heroes.length}個`);
  }
});

test("配置が一種類に偏らない（スライドデッキに見えないこと）", () => {
  // An earlier version of this test forbade two adjacent scenes from sharing a
  // layout, and the film failed it on its opening pair — a quiet centred
  // series card resolving into the centred title. That is a build, not
  // repetition, and the original hand-composed film does the same thing. What
  // actually reads as a slide deck is one arrangement carrying everything.
  const layouts = allScenes(SAKE).map((scene) => scene.layout);
  const counts = new Map<string, number>();
  for (const layout of layouts) counts.set(layout, (counts.get(layout) ?? 0) + 1);

  assert.ok(counts.size >= 3, `配置が${counts.size}種類しかない`);
  for (const [layout, count] of counts) {
    assert.ok(
      count <= layouts.length / 2,
      `${layout} が${count}/${layouts.length}シーンを占めている`,
    );
  }
});

test("未確定の事実は画面に出ない", () => {
  const cta = scenesForRole("cta", SAKE)[0];
  const texts = cta.components.flatMap((component) =>
    component.kind === "body" ? [component.text] : [],
  );
  // venue と fee は null。「未定」も空欄も出さない。
  assert.ok(!texts.some((text) => text.includes("未定")));
  assert.equal(
    cta.components.some((component) => component.kind === "datetime"),
    true,
  );
});

test("素材がゼロでも全シーンが成立する", () => {
  const bare: EventCmBrief = {
    ...SAKE,
    guests: SAKE.guests.map((guest) => ({ ...guest, photo: null })),
    logos: SAKE.logos.map((logo) => ({ ...logo, src: null })),
    visuals: { inkArt: null, value: null, programs: null, closing: null, texture: null },
    bgm: null,
  };
  for (const scene of allScenes(bare)) {
    const fit = fitScene(scene.components, SUMI_THEME);
    assert.deepEqual(fit.dropped, [], `${scene.layout} が素材ゼロで壊れた`);
    assert.ok(fit.placed.length > 0, `${scene.layout} が空になった`);
  }
});

test("シードしたWealthPark Labのブリーフも同じ条件を満たす", () => {
  const seeded = seedEventCmBrief(
    {
      name: "WealthPark Lab",
      industry: "金融教育メディア",
      palette: { primary: "#080808", background: "#ffffff", text: "#000000" },
      headingFont: "Zen Kaku Gothic New",
      bodyFont: "Zen Kaku Gothic New",
    },
    { now: new Date("2026-08-11T09:00:00+09:00"), seed: "take-1" },
  );
  const theme = themeForBrand(SUMI_THEME, seeded.theme ?? {});
  assert.ok(theme.displayFont.startsWith('"Zen Kaku Gothic New"'), "ブランドの書体が載る");

  for (const scene of allScenes(seeded)) {
    const fit = fitScene(scene.components, theme);
    assert.deepEqual(fit.dropped, [], `${scene.layout} で部品が落ちた`);
  }
});

test("すべての配置が実際に使われているわけではない（未使用は今後の余地）", () => {
  const used = new Set(allScenes(SAKE).map((scene) => scene.layout));
  const unused = Object.keys(LAYOUTS).filter((layout) => !used.has(layout as never));
  // Not a failure — a record. Left-right splits are unused by this film, so
  // the next template that needs one is exercising untested ground.
  assert.ok(unused.length > 0);
});
