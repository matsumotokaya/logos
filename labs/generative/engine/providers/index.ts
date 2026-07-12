// Provider registry + selection. Requested engine without a key falls back
// to the mock — the run is honestly labeled (mock: true) everywhere: UI,
// job log, audit trail.

import type { EngineId } from "@/labs/generative/core/expression-format";
import type { EngineStatusDto } from "@/labs/generative/core/api-types";
import type { Provider } from "./types";
import { togetherProvider } from "./together";
import { recraftProvider } from "./recraft";
import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";

const ENGINE_PROVIDERS: Record<EngineId, Provider> = {
  flux2: togetherProvider,
  recraft: recraftProvider,
  gemini: geminiProvider,
};

export function pickProvider(engine: EngineId): {
  provider: Provider;
  mock: boolean;
} {
  const requested = ENGINE_PROVIDERS[engine];
  if (requested.available()) return { provider: requested, mock: false };
  return { provider: mockProvider, mock: true };
}

export function engineStatuses(): EngineStatusDto[] {
  return [togetherProvider, recraftProvider, geminiProvider].map((p) => ({
    id: p.id,
    name: p.name,
    roleJa: p.roleJa,
    available: p.available(),
    costPerImageUsd: p.costPerImageUsd,
    notesJa: p.notesJa,
  }));
}
