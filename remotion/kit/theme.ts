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
   * - `none`   nothing.
   */
  backdrop: "none" | "scrim" | "shadow" | "plate";
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
  caption: ThemeCaption;
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
  // Set in the text face rather than the display mincho: a subtitle is read,
  // not composed, and mincho at 34px over moving footage loses its hairlines.
  caption: { size: 34, bottom: 72, color: "#ffffff", backdrop: "plate" },
};

export interface BrandThemeInput {
  palette?: { primary?: string; accent?: string; background?: string; text?: string };
  headingFont?: string | null;
  bodyFont?: string | null;
}

const FALLBACK_SANS =
  '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

/**
 * Dress a theme in a brand's own values.
 *
 * Only what the brand actually has is applied. A brand with no accent — which
 * is a real answer, not a gap (lib/brand/site-palette.ts) — keeps the base
 * theme's accent, and the caller records that as the tool's proposal rather
 * than as the brand's colour.
 */
export function themeForBrand(base: Theme, brand: BrandThemeInput): Theme {
  const heading = brand.headingFont?.trim();
  const body = brand.bodyFont?.trim();
  const quoted = (family: string) => `"${family}", ${FALLBACK_SANS}`;

  return {
    ...base,
    id: `${base.id}+brand`,
    palette: {
      ...base.palette,
      ...(brand.palette?.accent ? { accent: brand.palette.accent } : {}),
    },
    displayFont: heading ? quoted(heading) : base.displayFont,
    textFont: body ? quoted(body) : base.textFont,
  };
}
