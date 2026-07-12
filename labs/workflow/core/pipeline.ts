// Shared pipeline DTOs — the contract between the browser (catalog UI),
// the API routes and the server-side engine. No fs / no sharp here so the
// client bundle can import freely.

import type { LogoColorMode, Template2D } from "./template-format";

/** Logo payload sent to the compositor. Only ever to our own server. */
export type ComposeLogo =
  | { kind: "svg"; svg: string }
  | { kind: "png"; dataUri: string };

export type ComposeOptions = {
  /** Output width in px (height follows the template canvas ratio). */
  width?: number;
  /** Multiplier on the template's recommended logo width (clamped to min/max). */
  logoScale?: number;
  /** Nudge in surface UV space; clear space is still enforced. */
  offsetU?: number;
  offsetV?: number;
  /** Override the template's color treatment. */
  colorMode?: LogoColorMode;
};

export type ComposeRequest = ComposeOptions & {
  templateId: string;
  logo: ComposeLogo;
};

export type ComposeMetrics = {
  templateId: string;
  outWidth: number;
  outHeight: number;
  /** Effective logo width as a fraction of the surface, after clamping. */
  appliedWidth: number;
  logoRasterPx: { width: number; height: number };
  stageMs: number;
  logoMs: number;
  warpMs: number;
  compositeMs: number;
  totalMs: number;
};

/** One catalog row from GET /api/labs/workflow/templates. */
export type CatalogEntryDto = {
  id: string;
  template?: Template2D;
  errors: string[];
};

export type TemplateAggregate = {
  templateId: string;
  jobs: number;
  failures: number;
  avgRenderMs: number;
  maxRenderMs: number;
  totalExternalCostUsd: number;
};

/** GET /api/labs/workflow/jobs — the unit-cost view for pricing work. */
export type JobsSummary = {
  totalJobs: number;
  byTemplate: TemplateAggregate[];
};
