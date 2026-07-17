// POST: one exploration-mode generation.
//
// Flow: template → preset dials (locks applied) → mapping layer → prompt
// assembly (skeleton + wrapped context + dial directives) → provider
// (requested engine, or the mock when its key is missing) → immediate
// persistence to own storage → metered/audited job record. The response is
// metadata only; the image is served from /outputs/<name>.

import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { loadExpressionTemplate } from "@/labs/generative/engine/registry";
import { pickProvider } from "@/labs/generative/engine/providers";
import { rasterizeReferenceLogo } from "@/labs/generative/engine/logo-raster";
import { saveOutput } from "@/labs/generative/engine/storage";
import {
  appendGenJob,
  hashLogoSource,
  newJobId,
} from "@/labs/generative/engine/job-log";
import { resolveDials, PRESETS, type PresetId } from "@/labs/generative/core/dials";
import { mapDialsToParams } from "@/labs/generative/core/mapping";
import { assemblePrompt } from "@/labs/generative/core/prompt";
import type {
  GenerateMeta,
  GenerateRequest,
  GenerativeLogo,
} from "@/labs/generative/core/api-types";
import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";

const MAX_LOGO_BYTES = 3 * 1024 * 1024;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function parseLogo(raw: unknown): GenerativeLogo {
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

export async function POST(req: Request) {
  if (!labsEnabled()) return labsDisabledResponse();
  let body: GenerateRequest;
  let logo: GenerativeLogo;
  let preset: PresetId;
  let palette: string[];
  try {
    body = (await req.json()) as GenerateRequest;
    logo = parseLogo(body.logo);
    if (typeof body.templateId !== "string") throw new Error("templateId が必要");
    if (!Object.keys(PRESETS).includes(body.preset as string))
      throw new Error(`preset: ${Object.keys(PRESETS).join("/")} のいずれか`);
    preset = body.preset;
    if (body.context !== undefined && typeof body.context !== "string")
      throw new Error("context: 文字列");
    palette = Array.isArray(body.palette)
      ? body.palette.filter((c): c is string => typeof c === "string" && HEX_RE.test(c)).slice(0, 6)
      : [];
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "リクエストを解釈できない" },
      { status: 400 },
    );
  }

  const jobId = newJobId();
  const logoHash = hashLogoSource(logo.kind === "svg" ? logo.svg : logo.dataUri);
  const t0 = performance.now();
  // Money already paid to a provider must be metered even when a later step
  // (e.g. persistence) fails.
  let spentUsd = 0;

  try {
    const template = await loadExpressionTemplate(body.templateId);
    const dials = resolveDials(preset, template);
    const params = mapDialsToParams(template.engine, dials, template);
    const { prompt, negative } = assemblePrompt(template, dials, body.context, palette);
    const width = template.output?.width ?? 1024;
    const height = template.output?.height ?? 1024;

    const { provider, mock } = pickProvider(template.engine);
    const logoPng = await rasterizeReferenceLogo(logo);
    const { png, costUsd } = await provider.generate({
      prompt,
      negativePrompt: negative,
      logoPng,
      width,
      height,
      params,
    });
    spentUsd = costUsd;

    // 即時回収: persist before responding; no external URL survives this call.
    const output = await saveOutput(png);
    const genMs = Math.round(performance.now() - t0);
    // Providers may adjust the size to model constraints (e.g. FLUX.2's
    // pixel-count range) — meter what actually came back, not the request.
    const outMeta = await sharp(png).metadata();
    const outWidth = outMeta.width ?? width;
    const outHeight = outMeta.height ?? height;

    await appendGenJob({
      ts: new Date().toISOString(),
      jobId,
      templateId: template.id,
      taxonomy: template.taxonomy,
      engineRequested: template.engine,
      engineUsed: provider.id,
      mock,
      preset,
      dials,
      params,
      logoHash,
      logoSentTo: mock ? null : provider.id,
      prompt,
      outWidth,
      outHeight,
      genMs,
      costUsd,
      retries: 0,
      ok: true,
      outputFile: output.name,
    });

    const meta: GenerateMeta = {
      jobId,
      templateId: template.id,
      engineRequested: template.engine,
      engineUsed: provider.id,
      mock,
      preset,
      dials,
      params,
      prompt,
      costUsd,
      genMs,
      output: { url: output.url, width: outWidth, height: outHeight },
    };
    return Response.json(meta, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成に失敗した";
    await appendGenJob({
      ts: new Date().toISOString(),
      jobId,
      templateId: body.templateId,
      taxonomy: "unknown",
      engineRequested: "unknown",
      engineUsed: "unknown",
      mock: false,
      preset,
      dials: { shape: 0, color: 0, text: 0, world: 0 },
      params: {},
      logoHash,
      logoSentTo: null,
      prompt: "",
      outWidth: 0,
      outHeight: 0,
      genMs: Math.round(performance.now() - t0),
      costUsd: spentUsd,
      retries: 0,
      ok: false,
      error: message,
    });
    return Response.json({ error: message }, { status: 422 });
  }
}
