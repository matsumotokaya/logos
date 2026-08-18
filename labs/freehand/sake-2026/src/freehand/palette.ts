// Freehand art direction: 墨×金×明朝, cinema first.
//
// This file deliberately ignores the kit theme. The lab's question is "what
// does this film look like when a person art-directs it", so the palette is
// opinionated and the type is mincho throughout — the template's brand-theme
// gothic is exactly what flattened the mood.

import { loadFont as loadShippori } from "@remotion/google-fonts/ShipporiMincho";

const shippori = loadShippori("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["japanese", "latin"],
});

export const FH = {
  font: shippori.fontFamily,
  /** Warm ink, not navy. The ground everything sits on. */
  ink: "#0c0a08",
  inkSoft: "#161210",
  /** Gold: the one colour that means somebody decided. */
  gold: "#c9a227",
  goldBright: "#e9cd7a",
  goldDim: "rgba(201,162,39,0.55)",
  /** Warm paper white for type. Pure #fff glares on dark photography. */
  paper: "#f4efe4",
  paperMuted: "rgba(244,239,228,0.72)",
  paperFaint: "rgba(244,239,228,0.45)",
} as const;

/** Cinemascope letterbox: bar height in composition pixels (1920×1080). */
export const LETTERBOX = 132;

/** Kanji numerals for the programme trio. Plain 一二三 — the formal 壱弐参 was
 *  tried first and read as overdressed (client call, 2026-08-18). */
export const KANJI_NUMERALS = ["一", "二", "三"] as const;
