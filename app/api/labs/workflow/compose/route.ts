// POST: deterministic 2D composition. The logo never leaves this server —
// Phase 3's AI stage generation will receive prompts only, never the artwork.
// Every job (success or failure) is metered into the JSONL cost log.

import { performance } from "node:perf_hooks";
import { composeTemplate } from "@/labs/workflow/engine/compose";
import { appendJob, hashLogoSource } from "@/labs/workflow/engine/job-log";
import { loadTemplate } from "@/labs/workflow/engine/registry";
import type { ComposeLogo, ComposeRequest } from "@/labs/workflow/core/pipeline";

const COLOR_MODES = ["original", "mono-dark", "mono-light"];
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

function parseLogo(raw: unknown): ComposeLogo {
  const rec = raw as { kind?: string; svg?: string; dataUri?: string } | null;
  if (rec?.kind === "svg" && typeof rec.svg === "string" && rec.svg.length > 0) {
    if (rec.svg.length > MAX_LOGO_BYTES) throw new Error("ロゴが大きすぎる(3MB上限)");
    return { kind: "svg", svg: rec.svg };
  }
  if (rec?.kind === "png" && typeof rec.dataUri === "string") {
    if (rec.dataUri.length > MAX_LOGO_BYTES) throw new Error("ロゴが大きすぎる(3MB上限)");
    if (!rec.dataUri.startsWith("data:image/png;base64,"))
      throw new Error("PNGロゴは base64 data URI で送ること");
    return { kind: "png", dataUri: rec.dataUri };
  }
  throw new Error("logo: { kind: 'svg', svg } または { kind: 'png', dataUri } が必要");
}

const clampNum = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;

export async function POST(req: Request) {
  const t0 = performance.now();
  let body: ComposeRequest;
  let logo: ComposeLogo;
  try {
    body = (await req.json()) as ComposeRequest;
    logo = parseLogo(body.logo);
    if (typeof body.templateId !== "string") throw new Error("templateId が必要");
    if (body.colorMode !== undefined && !COLOR_MODES.includes(body.colorMode))
      throw new Error(`colorMode: ${COLOR_MODES.join("/")} のいずれか`);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "リクエストを解釈できない" },
      { status: 400 },
    );
  }

  const logoHash = hashLogoSource(logo.kind === "svg" ? logo.svg : logo.dataUri);
  try {
    const { template, dir } = await loadTemplate(body.templateId);
    const { png, metrics } = await composeTemplate(template, dir, logo, {
      width: clampNum(body.width, 320, 2600, 1600),
      logoScale: clampNum(body.logoScale, 0.25, 3, 1),
      offsetU: clampNum(body.offsetU, -1, 1, 0),
      offsetV: clampNum(body.offsetV, -1, 1, 0),
      colorMode: body.colorMode,
    });

    await appendJob({
      ts: new Date().toISOString(),
      templateId: body.templateId,
      logoHash,
      outWidth: metrics.outWidth,
      outHeight: metrics.outHeight,
      renderMs: metrics.totalMs,
      externalCostUsd: 0,
      retries: 0,
      ok: true,
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Compose-Metrics": JSON.stringify(metrics),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "合成に失敗した";
    await appendJob({
      ts: new Date().toISOString(),
      templateId: body.templateId,
      logoHash,
      outWidth: 0,
      outHeight: 0,
      renderMs: Math.round(performance.now() - t0),
      externalCostUsd: 0,
      retries: 0,
      ok: false,
      error: message,
    });
    return Response.json({ error: message }, { status: 422 });
  }
}
