// A theme: how components are painted, and how things move.
//
// The theme is where a brand's accumulated assets finally land. Today the sake
// template hardcodes mincho and gold, so the palette and typography adopted
// into brand_knowledge_values have nowhere to go — a brand can be fully
// understood and its video still looks like somebody else's. A theme built
// from those values fixes exactly that.
//
// **Motion belongs to the theme, not to the scene.** If a scene owned its
// entrances, swapping the theme would mean rewriting every scene, and the
// combinations would stop being finite. With motion here, any scene plays
// under any theme — which is what "change the tone, the colour and the type
// and it works for anything" requires.

import type { Emphasis } from "./components";

export interface TypeStep {
  /** Cap height in composition pixels (1920×1080 stage). */
  size: number;
  lineHeight: number;
  /** Letter spacing in em. Japanese display type wants positive tracking. */
  tracking: number;
  /**
   * How many Japanese characters fit on one line at this size, across the
   * stage's text column. Full-width, so Latin fits roughly twice as many —
   * fit.ts measures in full-width units.
   */
  charsPerLine: number;
  /** Lines this step may occupy before the fitter steps down (fit.ts). */
  maxLines: number;
}

export interface ThemePalette {
  /** The canvas. */
  ground: string;
  /** Type on the ground. */
  ink: string;
  /** Type that recedes. */
  muted: string;
  /** Type that nearly disappears — labels, credits. */
  faint: string;
  /** The one colour that draws the eye. Rules, numerals, highlights. */
  accent: string;
  /** A brighter reading of the accent, for gradients and glints. */
  accentBright: string;
}

/** How a component arrives and leaves. Named, not free-form, so a scene can
 *  ask for a feeling without specifying frames. */
export const MOTION_MOVES = [
  "fade",
  "rise",
  "settle",
  "wipe",
  "draw",
  "bloom",
] as const;
export type MotionMove = (typeof MOTION_MOVES)[number];

export interface ThemeMotion {
  /** Move used when a component enters, by emphasis. */
  enter: Record<Emphasis, MotionMove>;
  exit: MotionMove;
  /** Frames a component takes to arrive. */
  enterFrames: number;
  exitFrames: number;
  /** Something alive behind everything, all film long. */
  background: "still" | "particles" | "grain" | "drift";
  /** What happens between scenes. `card` is the interstitial title plate. */
  transition: "cut" | "fade" | "card" | "wipe";
}

export interface ThemeOrnament {
  /** Rules and marks drawn in the accent — structure in this art direction. */
  rules: boolean;
  /** Glyph used by the `mark` component. */
  markGlyph: string;
  /** Corner presence: a persistent avatar, a logo bug, nothing. */
  corner: "none" | "logo" | "avatar";
}

/**
 * How subtitles are set.
 *
 * Part of the theme rather than the composition because subtitles are always
 * present — business video is watched muted — so the only question a template
 * ever asks is how they look, never whether to draw them.
 */
export interface ThemeCaption {
  size: number;
  /** Distance from the bottom of the frame, in composition pixels. */
  bottom: number;
  color: string;
  /**
   * What sits behind the text.
   *
   * - `plate`  a solid block fitted to the line. Reads as a separate layer,
   *            which is the point: a subtitle lands on photography and on the
   *            scene's own typography, and trying to blend produces the one
   *            outcome that cannot be accepted — a line nobody can read.
   * - `scrim`  a gradient darkening the lower frame. Gentler, and unreliable
   *            over a bright photo or a light scene.
   * - `shadow` glow only. For films that are always dark.
   * - `bar`    the bottom letterbox bar (chrome.letterbox). The subtitle sits
   *            centred inside it, on black that is already there — no plate,
   *            no collision with the picture, ever. Requires a letterbox.
   * - `none`   nothing.
   */
  backdrop: "none" | "scrim" | "shadow" | "plate" | "bar";
}

/**
 * The frame around the film.
 *
 * A letterbox is the single cheapest move that makes a sequence of stills read
 * as cinema — it declares an aspect ratio somebody chose (Freehand Lab,
 * 2026-08-18: it outranked every other change per line of code). It also gives
 * subtitles a home that can never collide with the picture (`backdrop: "bar"`).
 * `null` means no bars: the frame is the composition's own edge.
 */
export interface ThemeChrome {
  /** Bar height top and bottom, in composition pixels, or null for none. */
  letterbox: number | null;
}

/**
 * How a photograph laid under a scene is treated.
 *
 * Lifted straight out of 世界が恋する日本酒, where `SceneBackdrop` dimmed the
 * same photograph to 0.5 behind the promise and 0.22 behind the programme, put
 * a radial scrim over it, and pushed it slowly for the length of the scene.
 * Here rather than in the scene for the usual reason: motion and treatment
 * belong to the theme, or swapping the theme means rewriting every scene.
 */
export interface ThemeBackdrop {
  /** Photo opacity under the scrim, by what the picture is doing in the scene. */
  opacity: Record<"hero" | "support", number>;
  /** Drawn over the photograph so type stays legible on any photograph. Used
   *  when the layout centres its copy — a radial dim is all that works there. */
  scrim: string;
  /**
   * The directional alternative: darkness only where the copy is, so the
   * photograph stays a photograph on its own side of the frame.
   *
   * The measured lesson behind it (Freehand Lab): a full-frame dim at 0.22
   * turned every agenda scene into a near-black screen — "footage of nothing".
   * With darkness applied directionally, the same photograph carries type at
   * nearly full presence. The layout says WHICH side (LayoutSpec.copySide);
   * the theme says how dark and how far. `null` falls back to `scrim`.
   */
  directional: { strength: number; reach: number } | null;
  /** Ken Burns: scale at the start of the scene and at the end. */
  push: [number, number];
}

export interface Theme {
  id: string;
  name: string;
  palette: ThemePalette;
  /** Display family — headings, numerals, anything set large. */
  displayFont: string;
  /** Text family — everything else. */
  textFont: string;
  scale: Record<Emphasis, TypeStep>;
  motion: ThemeMotion;
  ornament: ThemeOrnament;
  backdrop: ThemeBackdrop;
  caption: ThemeCaption;
  chrome: ThemeChrome;
}

/**
 * The sake template's art direction, lifted out of the composition it was
 * written into. This is the reference theme: if the vocabulary cannot
 * reproduce 世界が恋する日本酒 under `sumi`, the vocabulary is not finished.
 */
export const SUMI_THEME: Theme = {
  id: "sumi",
  name: "墨（和モダン）",
  palette: {
    ground: "#0b0d13",
    ink: "#f4efe4",
    muted: "rgba(244,239,228,0.62)",
    faint: "rgba(244,239,228,0.34)",
    accent: "#c9a45c",
    accentBright: "#e6c98b",
  },
  displayFont:
    '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", "Times New Roman", serif',
  textFont:
    '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", "Times New Roman", serif',
  scale: {
    hero: { size: 132, lineHeight: 1.24, tracking: 0.06, charsPerLine: 11, maxLines: 2 },
    primary: { size: 64, lineHeight: 1.5, tracking: 0.08, charsPerLine: 22, maxLines: 3 },
    secondary: { size: 38, lineHeight: 1.7, tracking: 0.06, charsPerLine: 36, maxLines: 4 },
    caption: { size: 24, lineHeight: 1.6, tracking: 0.22, charsPerLine: 52, maxLines: 2 },
  },
  motion: {
    enter: { hero: "rise", primary: "settle", secondary: "fade", caption: "fade" },
    exit: "fade",
    enterFrames: 18,
    exitFrames: 12,
    background: "drift",
    transition: "fade",
  },
  ornament: { rules: true, markGlyph: "—", corner: "none" },
  // Photography at nearly full presence, darkened only on the copy's side.
  // The old values (hero 0.5, support 0.22 under a full radial scrim) are the
  // measured reason the agenda scenes read as black screens — the client's
  // "クリエイティビティがゼロ" verdict traced to exactly this pair of numbers.
  backdrop: {
    opacity: { hero: 1, support: 0.88 },
    scrim:
      "radial-gradient(85% 75% at 50% 50%, rgba(11,13,19,0.42) 0%, rgba(11,13,19,0.8) 100%)",
    directional: { strength: 0.74, reach: 76 },
    push: [1.04, 1.13],
  },
  // Inside the letterbox bar: black that is already there, so the line never
  // fights the picture and never needs a plate.
  caption: { size: 34, bottom: 0, color: "#f4efe4", backdrop: "bar" },
  chrome: { letterbox: 132 },
};

/**
 * How much of the bottom of the frame belongs to the subtitle.
 *
 * Subtitles are mandatory in this template — the film is watched muted — so the
 * band is not something a scene may compose over. Before this, `full-bleed-overlay`
 * set its copy at the stage margin (96px) while the plate sat from 72px to about
 * 150px, and the promise scene's own words ran through the subtitle. Both are
 * legible alone and neither is legible together.
 *
 * Two lines' worth, because a subtitle that wraps must not start the collision
 * again. Bottom-anchored regions keep clear of it; centred ones are the fitter's
 * business (fit.ts), since a centred block only reaches down here when it is
 * already too tall.
 */
export const captionSafeBottom = (theme: Theme): number => {
  // Inside the letterbox bar the subtitle occupies chrome the picture never
  // had, so scenes only keep clear of the bar itself.
  if (theme.caption.backdrop === "bar") {
    return (theme.chrome.letterbox ?? 0) + 40;
  }
  // The plate's own geometry, as CaptionBand draws it: 1.5 line-height and
  // 0.42em of padding above and below. Guessing a multiple of the font size
  // instead left a nine-pixel overlap — close enough to look like a mistake
  // rather than a margin.
  const line = theme.caption.size * 1.5;
  const padding = theme.caption.size * 0.84;
  const plate = line * 2 + padding;
  return Math.round(theme.caption.bottom + plate + 24);
};

export interface BrandThemeInput {
  palette?: { primary?: string; accent?: string; background?: string; text?: string };
  headingFont?: string | null;
  bodyFont?: string | null;
}

/**
 * Dress a theme in a brand's own values.
 *
 * Only what the brand actually has is applied. A brand with no accent — which
 * is a real answer, not a gap (lib/brand/site-palette.ts) — keeps the base
 * theme's accent, and the caller records that as the tool's proposal rather
 * than as the brand's colour.
 *
 * COLOUR ONLY — the brand's typography is deliberately not adopted (2026-08-18,
 * from the Freehand Lab's first finding). The sake film rendered in the brand's
 * gothic, and the gothic was the first thing that broke the art direction: the
 * gold and the ink lost their meaning under a face that belongs to a business
 * site. This is the same judgment the LP templates already made — "1顧客ごとに
 * 変わるべきなのは色であって組版ではない" (README, LPテンプレート) — arriving
 * at video. The theme's mincho IS the template; the accent is the brand's.
 */
export function themeForBrand(base: Theme, brand: BrandThemeInput): Theme {
  return {
    ...base,
    id: `${base.id}+brand`,
    palette: {
      ...base.palette,
      ...(brand.palette?.accent ? { accent: brand.palette.accent } : {}),
    },
  };
}
