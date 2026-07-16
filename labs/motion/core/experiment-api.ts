// Logo Motion Lab — the common contract every experiment implements.
//
// An experiment is a single self-contained component that receives a
// preprocessed logo and renders/plays its expression inside its own canvas.
// Keeping this interface tiny is what makes experiments portable back into
// the production presentation later.

import type { ComponentType } from "react";
import type { BrandColor, ViewBox } from "@/lib/svg";

export type LogoKind = "svg" | "png";

/** A logo after preprocessing, ready to be handed to any experiment. */
export type LabLogo = {
  id: string;
  name: string;
  kind: LogoKind;
  /** True for the bundled test logos (cannot be deleted). */
  builtin?: boolean;
  /** Canonical logos record rather than a bundled Lab fixture. */
  canonical?: boolean;
  /** Current primary candidate used by candidate-scoped asset runs. */
  candidateId?: string;
  /** Baked SVG markup (viewBox normalized, computed paint written as attributes). */
  svg?: string;
  /** Data URI for raster logos. */
  pngDataUri?: string;
  viewBox: ViewBox;
  /** Area-weighted palette, dominant first. Experiments must only use these + neutrals. */
  colors: BrandColor[];
  /** Number of drawable shapes (path/circle/rect...) — used to judge stagger potential. */
  shapeCount: number;
};

/**
 * Props every experiment receives. Playback is controlled from outside:
 * - `playing` toggles play/pause of the experiment's timeline.
 * - `replayNonce` changing means "restart from the beginning".
 */
export type ExperimentProps = {
  logo: LabLogo;
  playing: boolean;
  replayNonce: number;
};

export type ExperimentComponent = ComponentType<ExperimentProps>;

export type ExperimentCategory =
  | "reveal"
  | "texture"
  | "ambient"
  | "presentation"
  | "three"
  | "export";

export type ExperimentTech =
  | "gsap"
  | "css"
  | "svg"
  | "canvas"
  | "three"
  | "lottie";

export type ExperimentStatus = "done" | "wip" | "planned";

export type ExperimentMeta = {
  /** Zero-padded serial, e.g. "001". Doubles as the registry key. */
  id: string;
  slug: string;
  title: string;
  category: ExperimentCategory;
  tech: ExperimentTech[];
  /** Impression tags, e.g. 荘厳 / 軽快 / ミニマル / テック / クラフト. */
  impressions: string[];
  /** Human-readable timing, e.g. "2.6s reveal + 10s drift". */
  duration: string;
  supports: LogoKind[];
  /** The custom easing(s) this experiment was tuned with — record, don't lose. */
  easing?: string;
  /** Implementation notes / evaluation hints. */
  notes?: string;
  status: ExperimentStatus;
};

export const CATEGORY_LABELS: Record<ExperimentCategory, string> = {
  reveal: "Reveal(出現)",
  texture: "質感",
  ambient: "常駐ループ",
  presentation: "プレゼンテーション",
  three: "3D",
  export: "書き出し検証",
};

/** Whether an experiment can run with the given logo. */
export function supportsLogo(meta: ExperimentMeta, logo: LabLogo): boolean {
  return meta.supports.includes(logo.kind);
}
