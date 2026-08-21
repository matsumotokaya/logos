import assert from "node:assert/strict";
import test from "node:test";
import {
  captionSafeBottom,
  LEGACY_THEME_ID,
  NEW_FILM_THEME_ID,
  STANDARD_THEME,
  SUMI_THEME,
  THEMES,
  themeById,
} from "@/remotion/kit/theme";

test("未設定のアートディレクションは墨に落ちる", () => {
  // Every take that exists predates `brief.artDirection`, and one of them is a
  // delivered commission. Resolving "unset" to the new default would repaint
  // an approved film, so this must never become STANDARD_THEME.
  assert.equal(LEGACY_THEME_ID, SUMI_THEME.id);
  assert.equal(themeById(undefined).id, SUMI_THEME.id);
  assert.equal(themeById(null).id, SUMI_THEME.id);
  assert.equal(themeById("").id, SUMI_THEME.id);
});

test("知らないIDは落ちずに墨へ倒す", () => {
  // The id comes from a database row a newer build may have written. A film in
  // the wrong art direction is recoverable; one that refuses to render is not.
  assert.equal(themeById("themes-not-in-this-build").id, SUMI_THEME.id);
});

test("新規の動画はスタンダードで始まる", () => {
  // 墨 is the derivative: it came first only because the first commission was
  // a 和モダン event.
  assert.equal(NEW_FILM_THEME_ID, STANDARD_THEME.id);
  assert.notEqual(NEW_FILM_THEME_ID, LEGACY_THEME_ID);
});

test("字幕を帯に置くテーマはレターボックスを持つ", () => {
  // `backdrop: "bar"` means the subtitle sits inside chrome. Without bars there
  // is no chrome, and captionSafeBottom would reserve 40px for a band drawn at
  // the frame edge.
  for (const theme of Object.values(THEMES)) {
    if (theme.caption.backdrop === "bar") {
      assert.ok(
        theme.chrome.letterbox,
        `${theme.id}: 帯に字幕を置くならレターボックスが要る`,
      );
    }
  }
});

test("どのテーマも素材ゼロの地を持っている", () => {
  // "素材ゼロでも完成した動画が出る" is a requirement of this template, and with
  // no photograph the ground is all there is. 墨 satisfies it with
  // EventBackground (motion.background), a flat theme needs a wash.
  for (const theme of Object.values(THEMES)) {
    const hasAtmosphere =
      theme.motion.background !== "still" || theme.palette.groundWash !== null;
    assert.ok(hasAtmosphere, `${theme.id}: 素材が無いとき地が平坦になる`);
  }
});

test("墨の承認済みジオメトリは動かない", () => {
  // The three baked takes were approved at these numbers. If a change to the
  // caption or chrome vocabulary moves them, it changed a delivered film.
  assert.equal(SUMI_THEME.chrome.letterbox, 132);
  assert.equal(captionSafeBottom(SUMI_THEME), 172);
  // What KitComponent's panel names clear: max(letterbox + 64, safe bottom).
  assert.equal(
    Math.max((SUMI_THEME.chrome.letterbox ?? 0) + 64, captionSafeBottom(SUMI_THEME)),
    196,
    "登壇者名の下余白は196pxのまま",
  );
});

test("スタンダードは字幕プレートを避ける余白を持つ", () => {
  assert.equal(STANDARD_THEME.chrome.letterbox, null);
  assert.equal(STANDARD_THEME.caption.backdrop, "plate");
  const safe = captionSafeBottom(STANDARD_THEME);
  // The bug this locks: the name used to sit at letterbox+64 = 64px, under a
  // plate reaching ~211px, so it was drawn through the subtitle.
  assert.ok(safe > 64, "プレートは64pxより高く積む");
  assert.equal(Math.max((STANDARD_THEME.chrome.letterbox ?? 0) + 64, safe), safe);
});

test("スタンダードは明るい地に濃い文字、墨はその逆", () => {
  // Not a cosmetic assertion: the directional scrim's tint has to match the
  // direction the type needs. A darkening scrim under dark type is unreadable.
  assert.deepEqual(SUMI_THEME.backdrop.directional?.tint, [8, 6, 4]);
  assert.deepEqual(STANDARD_THEME.backdrop.directional?.tint, [247, 249, 252]);
});

test("組版はアートディレクションごとに違う", () => {
  // Gothic carries more ink per character than mincho, so the same size reads
  // heavier. Sharing a scale between the two would make one of them wrong.
  assert.notEqual(STANDARD_THEME.displayFont, SUMI_THEME.displayFont);
  assert.ok(STANDARD_THEME.scale.hero.size < SUMI_THEME.scale.hero.size);
});
