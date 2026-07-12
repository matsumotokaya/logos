// Browser-side helpers for the Generative Lab endpoints.

import type { LabLogo } from "@/labs/motion/core/experiment-api";
import type {
  CatalogResponse,
  GenerateMeta,
  GenerateRequest,
  GenerativeLogo,
  GenJobsSummary,
} from "./api-types";
import type { PresetId } from "./dials";

/** LabLogo (shared logo registry) → generation payload. Null if unusable. */
export function generativeLogoPayload(logo: LabLogo): GenerativeLogo | null {
  if (logo.kind === "svg" && logo.svg) return { kind: "svg", svg: logo.svg };
  if (logo.kind === "png" && logo.pngDataUri)
    return { kind: "png", dataUri: logo.pngDataUri };
  return null;
}

export async function fetchGenerativeCatalog(): Promise<CatalogResponse> {
  const res = await fetch("/api/labs/generative/templates");
  if (!res.ok) throw new Error(`カタログ取得に失敗 (${res.status})`);
  return (await res.json()) as CatalogResponse;
}

export async function fetchGenJobsSummary(): Promise<GenJobsSummary> {
  const res = await fetch("/api/labs/generative/jobs");
  if (!res.ok) throw new Error(`集計取得に失敗 (${res.status})`);
  return (await res.json()) as GenJobsSummary;
}

export async function generate(
  templateId: string,
  logo: LabLogo,
  preset: PresetId,
  context: string,
  signal?: AbortSignal,
): Promise<GenerateMeta> {
  const payload = generativeLogoPayload(logo);
  if (!payload) throw new Error("このロゴは生成に使えない");

  const body: GenerateRequest = {
    templateId,
    logo: payload,
    preset,
    context: context || undefined,
    palette: logo.colors.slice(0, 6).map((c) => c.hex),
  };
  const res = await fetch("/api/labs/generative/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => null)) as
    | (GenerateMeta & { error?: string })
    | { error?: string }
    | null;
  if (!res.ok || !json || "error" in json && json.error)
    throw new Error((json as { error?: string })?.error ?? `生成に失敗 (${res.status})`);
  return json as GenerateMeta;
}
