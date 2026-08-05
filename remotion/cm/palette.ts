// Shared CM video constants + palette derivation, used by the composition,
// the persistent background and the equalizer.

import type { CampaignBrandKit } from "../../lib/campaign/schema";
import { isDarkTheme, resolveTheme } from "../../lib/campaign/themes";

export const CM_FPS = 30;
export const CM_WIDTH = 1920;
export const CM_HEIGHT = 1080;
/** Silent tail so the last caption / audio sample is never cut off. */
export const CM_TAIL_MS = 500;

export interface CmPalette {
  canvas: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  surface: string;
  onPrimary: string;
  dark: boolean;
}

export function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function buildPalette(kit: CampaignBrandKit): CmPalette {
  const theme = resolveTheme(kit);
  const glass = isDarkTheme(theme);
  // Dark themes get the dark cinematic canvas; light ones keep the brand's
  // own background so the CM matches the LP.
  const canvas = glass ? "#0a0f1e" : kit.brand.background;
  const dark = glass || hexLuminance(canvas) < 0.45;
  return {
    canvas,
    text: dark ? "#ffffff" : kit.brand.text,
    muted: dark ? "rgba(255,255,255,0.65)" : `${kit.brand.text}99`,
    primary: kit.brand.primary,
    accent: kit.brand.accent,
    surface: dark ? "rgba(255,255,255,0.08)" : kit.brand.surface,
    onPrimary: hexLuminance(kit.brand.primary) < 0.55 ? "#ffffff" : "#111111",
    dark,
  };
}

export function fontStack(kit: CampaignBrandKit): string {
  return kit.brand.font_style === "elegant-serif"
    ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
    : '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';
}
