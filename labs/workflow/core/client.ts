// Browser-side helpers for the compose pipeline endpoints.
// The logo travels only to our own Route Handlers — never to external APIs.

import type { LabLogo } from "@/labs/motion/core/experiment-api";
import type {
  CatalogEntryDto,
  ComposeLogo,
  ComposeMetrics,
  ComposeOptions,
  JobsSummary,
} from "./pipeline";

/** LabLogo (shared logo registry) → compose payload. Null if unusable. */
export function logoPayload(logo: LabLogo): ComposeLogo | null {
  if (logo.kind === "svg" && logo.svg) return { kind: "svg", svg: logo.svg };
  if (logo.kind === "png" && logo.pngDataUri)
    return { kind: "png", dataUri: logo.pngDataUri };
  return null;
}

export async function fetchCatalog(): Promise<CatalogEntryDto[]> {
  const res = await fetch("/api/labs/workflow/templates");
  if (!res.ok) throw new Error(`カタログ取得に失敗 (${res.status})`);
  const json = (await res.json()) as { templates: CatalogEntryDto[] };
  return json.templates;
}

export async function fetchJobsSummary(): Promise<JobsSummary> {
  const res = await fetch("/api/labs/workflow/jobs");
  if (!res.ok) throw new Error(`集計取得に失敗 (${res.status})`);
  return (await res.json()) as JobsSummary;
}

export type ComposeResult = {
  /** Object URL — caller must revokeObjectURL when replacing it. */
  url: string;
  metrics: ComposeMetrics;
};

export async function composePayloadToUrl(
  templateId: string,
  payload: ComposeLogo,
  options: ComposeOptions = {},
  signal?: AbortSignal,
): Promise<ComposeResult> {
  const res = await fetch("/api/labs/workflow/compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, logo: payload, ...options }),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `合成に失敗 (${res.status})`);
  }

  const metrics = JSON.parse(
    res.headers.get("X-Compose-Metrics") ?? "{}",
  ) as ComposeMetrics;
  const url = URL.createObjectURL(await res.blob());
  return { url, metrics };
}

export async function composeToUrl(
  templateId: string,
  logo: LabLogo,
  options: ComposeOptions = {},
  signal?: AbortSignal,
): Promise<ComposeResult> {
  const payload = logoPayload(logo);
  if (!payload) throw new Error("このロゴは合成に使えない");
  return composePayloadToUrl(templateId, payload, options, signal);
}
