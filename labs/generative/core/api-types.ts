// Shared DTOs — the contract between the browser, the API routes and the
// server-side engine. No fs / no sharp so the client bundle imports freely.

import type { Dials, EngineId, EngineParams, ExpressionTemplate } from "./expression-format";
import type { PresetId } from "./dials";

/** Logo payload. In exploration mode this DOES reach the chosen engine's
 *  external API (that is the mode's premise) — never any other provider. */
export type GenerativeLogo =
  | { kind: "svg"; svg: string }
  | { kind: "png"; dataUri: string };

export type GenerateRequest = {
  templateId: string;
  logo: GenerativeLogo;
  preset: PresetId;
  /** Industry / keywords; sanitized and wrapped server-side, never raw. */
  context?: string;
  /** Brand palette (hex) extracted client-side from the logo. */
  palette?: string[];
};

/** One finished generation. The image lives in our own storage — external
 *  provider URLs are collected immediately and never referenced again. */
export type GenerateMeta = {
  jobId: string;
  templateId: string;
  engineRequested: EngineId;
  /** "mock" when the requested engine has no API key configured. */
  engineUsed: EngineId | "mock";
  mock: boolean;
  preset: PresetId;
  dials: Dials;
  params: EngineParams;
  /** The exact prompt sent to the model — shown to the user by design. */
  prompt: string;
  costUsd: number;
  genMs: number;
  output: { url: string; width: number; height: number };
};

export type EngineStatusDto = {
  id: EngineId | "mock";
  name: string;
  roleJa: string;
  available: boolean;
  costPerImageUsd: number;
  notesJa?: string;
};

export type ExpressionCatalogEntry = {
  /** Directory name (canonical id, even when template.json is broken). */
  id: string;
  template?: ExpressionTemplate;
  errors: string[];
};

export type CatalogResponse = {
  engines: EngineStatusDto[];
  templates: ExpressionCatalogEntry[];
};

export type GenTemplateAggregate = {
  templateId: string;
  jobs: number;
  failures: number;
  avgGenMs: number;
  totalCostUsd: number;
};

export type GenEngineAggregate = {
  engine: string;
  jobs: number;
  failures: number;
  totalCostUsd: number;
};

export type RecentGenJob = {
  jobId: string;
  ts: string;
  templateId: string;
  engineUsed: string;
  mock: boolean;
  preset: PresetId;
  costUsd: number;
  outputUrl: string;
};

/** GET /api/labs/generative/jobs — cost + success-rate view (製品の資産). */
export type GenJobsSummary = {
  totalJobs: number;
  totalCostUsd: number;
  byTemplate: GenTemplateAggregate[];
  byEngine: GenEngineAggregate[];
  recent: RecentGenJob[];
};
