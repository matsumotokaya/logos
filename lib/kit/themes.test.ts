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
import { groundIsDark, markPainting } from "@/remotion/kit/mark";

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

// ---------------------------------------------------------------------------
// 地と同じ色のものを描かない
//
// The recurring defect in this repository is not a wrong filter — it is
// drawing something the same colour as what is behind it. It has now happened
// to a white mark on the standard ground, to a white rectangle in the closing
// credits, and to a near-black SVG on ink. These lock the rule that prevents
// the whole class, on both grounds, so a third art direction inherits it.

/** Every ground the product can paint on. */
const GROUNDS = Object.values(THEMES).map((theme) => ({
  id: theme.id,
  ground: theme.palette.ground,
  dark: groundIsDark(theme.palette.ground),
}));

test("測った透過ロゴは、どちらの地でも地の反対側に出る", () => {
  for (const { id, ground, dark } of GROUNDS) {
    for (const luminance of [0, 0.003, 0.2, 0.8, 1]) {
      const painting = markPainting(ground, { opaque: false, luminance });
      assert.equal(painting.draw, "artwork", `${id}: 透過ロゴが描かれていない`);
      if (painting.draw !== "artwork") continue;
      // Where the mark ends up, given the filter that was chosen.
      const painted =
        painting.treatment === "knockout"
          ? 1
          : painting.treatment === "blackout"
            ? 0
            : painting.treatment === "invert"
              ? 1 - luminance
              : luminance;
      assert.notEqual(
        painted >= 0.45,
        !dark,
        `${id}: 輝度${luminance}のロゴが地と同じ側に描かれる`,
      );
    }
  }
});

test("測っていないロゴは、素のままでは描かれない", () => {
  // `opaque ?? true` used to answer "not measured" with "opaque", which routed
  // it to `light` — drawn as supplied. That is how a 0.003 SVG landed unchanged
  // on ink and vanished, with the measurement sitting in brand_materials all
  // along. Unmeasured must reach the treatment that cannot fail.
  for (const { id, ground, dark } of GROUNDS) {
    for (const mark of [{}, { opaque: null }, { luminance: null }, { opaque: null, luminance: null }]) {
      const painting = markPainting(ground, mark);
      assert.equal(painting.draw, "artwork", `${id}: 未測定ロゴが描かれない`);
      if (painting.draw !== "artwork") continue;
      assert.equal(
        painting.treatment,
        dark ? "knockout" : "blackout",
        `${id}: 未測定ロゴが ${painting.treatment} で描かれている`,
      );
    }
  }
});

test("地と同じ明度の不透明ロゴは描かず、名前で出す", () => {
  // No filter can save this one: `knockout` paints the plate white and
  // `blackout` paints it black, so either way it is a rectangle. A rectangle is
  // a different defect, not a fix — the credit line is legible on any ground.
  const onInk = markPainting(SUMI_THEME.palette.ground, { opaque: true, luminance: 0.02 });
  assert.equal(onInk.draw, "credit");

  const onWhite = markPainting(STANDARD_THEME.palette.ground, {
    opaque: true,
    luminance: 0.98,
  });
  assert.equal(onWhite.draw, "credit");

  // The same artwork on the OTHER ground is fine as supplied, plate and all.
  const contrasting = markPainting(STANDARD_THEME.palette.ground, {
    opaque: true,
    luminance: 0.02,
  });
  assert.deepEqual(
    contrasting.draw === "artwork" ? contrasting.treatment : null,
    "light",
  );
});

test("記録された描き方は、証明できる衝突のときだけ上書きされる", () => {
  // Rule 1 exists to protect a delivered commission: its briefs carry a
  // treatment and no measurement, so nothing can be proven and nothing moves.
  const approved = markPainting(SUMI_THEME.palette.ground, { treatment: "light" });
  assert.deepEqual(
    approved.draw === "artwork" ? approved.treatment : null,
    "light",
    "測定が無いのに、記録された描き方を上書きしている",
  );

  // With a measurement, "light" on ink for a near-black transparent mark is
  // provably invisible — and a record is not a reason to draw nothing.
  const provable = markPainting(SUMI_THEME.palette.ground, {
    treatment: "light",
    opaque: false,
    luminance: 0.003,
  });
  assert.deepEqual(
    provable.draw === "artwork" ? provable.treatment : null,
    "knockout",
  );
});

test("どのテーマも組版の言語を宣言する", () => {
  // `word-break: auto-phrase` is inert without a language, and inert silently.
  // That silence is what made the effect look impossible in Remotion, so the
  // language is a required field rather than an optional one — a new art
  // direction cannot ship without answering it.
  for (const theme of Object.values(THEMES)) {
    assert.ok(
      typeof theme.lang === "string" && theme.lang.length > 0,
      `${theme.id}: 組版の言語が宣言されていない`,
    );
  }
});
