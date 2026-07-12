// The provider abstraction (E-1) — the shared foundation the assurance mode's
// Layer 3 (stage generation) will also build on. Server only.
//
// Contract highlights:
// - Providers receive the rasterized logo as a reference image. In this mode
//   sending the logo to the model IS the point — allowed providers only
//   (Together = ZDR default, Recraft = no-training clause). Ideogram and
//   OpenAI GPT Image are banned from the production pipeline (E-6 keeps them
//   benchmark-only, with in-house dummy logos, never customer artwork).
// - Outputs are returned as bytes and persisted to our own storage by the
//   caller immediately (即時回収): an external URL must never outlive the
//   request that produced it.
// - `customModelId` is accepted end-to-end but unused: the brand-trained
//   model interface required by the future-phase section of the README.

import type { EngineId, EngineParams } from "@/labs/generative/core/expression-format";

export type ProviderInput = {
  prompt: string;
  negativePrompt?: string;
  /** Rasterized logo (PNG, white background) used as the reference image. */
  logoPng: Buffer;
  width: number;
  height: number;
  params: EngineParams;
};

export type ProviderOutput = {
  png: Buffer;
  costUsd: number;
};

export type Provider = {
  id: EngineId | "mock";
  name: string;
  roleJa: string;
  /** List price per image (USD) — the UI's cost estimate before generating. */
  costPerImageUsd: number;
  notesJa?: string;
  /** Key configured? Checked per request so adding a key needs no restart. */
  available: () => boolean;
  generate: (input: ProviderInput) => Promise<ProviderOutput>;
};

/** Shared fetch guard: non-2xx → readable error with a trimmed body. */
export async function expectOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  const body = (await res.text().catch(() => "")).slice(0, 300);
  throw new Error(`${provider} API ${res.status}: ${body || res.statusText}`);
}
