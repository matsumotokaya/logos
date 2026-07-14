// The 2D compositing pipeline — server only.
//
// "The stage may come from AI (Phase 3); the logo is composited
// deterministically." This module is the deterministic half: rasterize the
// logo at the resolution the placement needs, project it onto the template's
// surface quad, bend it with the displacement map, then stack shadow, logo
// and baked lighting with the blend modes the template prescribes.
//
// Every stage is timed — per-job cost metering is a product requirement.

import path from "node:path";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import sharp, { type OverlayOptions, type Sharp } from "sharp";
import type {
  LightingLayer,
  LogoColorMode,
  Point,
  Template2D,
} from "@/labs/workflow/core/template-format";
import type {
  ComposeLogo,
  ComposeMetrics,
  ComposeOptions,
} from "@/labs/workflow/core/pipeline";
import {
  applyMat3,
  homographyFromPoints,
  homographyFromUnitSquare,
  warpImage,
  type Mat3,
  type RawImage,
} from "./homography";
import { warpImageUv, type RawImage16 } from "./uvwarp";

export const DEFAULT_WIDTH = 1600;
export const MAX_WIDTH = 2600;
const SUPERSAMPLE = 2;
const MAX_LOGO_RASTER = 4096;

const MONO_TINTS: Record<Exclude<LogoColorMode, "original">, [number, number, number]> = {
  "mono-dark": [23, 24, 26],
  "mono-light": [250, 250, 250],
};

/** Rasterize an asset (SVG at proper density, or bitmap) to an exact size. */
async function rasterizeAsset(file: Buffer, isSvg: boolean, w: number, h: number) {
  if (!isSvg) return sharp(file).resize(w, h, { fit: "fill" });
  const meta = await sharp(file).metadata();
  const density = Math.min(72 * (w / Math.max(meta.width ?? w, 1)), 9600);
  return sharp(file, { density: Math.max(density, 72) }).resize(w, h, { fit: "fill" });
}

async function loadRaw(pipeline: Sharp): Promise<RawImage> {
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** Load a baked 16-bit uv map (see UvWarpSpec) resized to the output size. */
async function loadUvMap(file: Buffer, w: number, h: number): Promise<RawImage16> {
  // sharp collapses to 8-bit unless the pipeline is pinned to rgb16.
  const { data, info } = await sharp(file)
    .pipelineColourspace("rgb16")
    .resize(w, h, { fit: "fill" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  const bytes = data.byteOffset % 2 === 0 ? data : Buffer.from(data);
  return {
    data: new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2),
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

/** Rasterize the logo with transparent background at the given pixel width. */
async function rasterizeLogo(
  logo: ComposeLogo,
  widthPx: number,
): Promise<RawImage> {
  if (logo.kind === "svg") {
    const buf = Buffer.from(logo.svg, "utf8");
    const meta = await sharp(buf).metadata();
    const intrinsicW = Math.max(meta.width ?? widthPx, 1);
    const density = Math.min(Math.max(72 * (widthPx / intrinsicW), 72), 9600);
    return loadRaw(sharp(buf, { density }).resize({ width: widthPx }));
  }
  const m = /^data:image\/png;base64,(.+)$/.exec(logo.dataUri);
  if (!m) throw new Error("compose: PNG logo must be a base64 data URI");
  return loadRaw(sharp(Buffer.from(m[1], "base64")).resize({ width: widthPx }));
}

/** Get the logo's aspect ratio (h/w) without a full-size rasterization. */
async function logoAspect(logo: ComposeLogo): Promise<number> {
  const buf =
    logo.kind === "svg"
      ? Buffer.from(logo.svg, "utf8")
      : Buffer.from(/^data:image\/png;base64,(.+)$/.exec(logo.dataUri)?.[1] ?? "", "base64");
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error("compose: logo has no drawable size");
  return meta.height / meta.width;
}

/** Replace RGB with a flat tint, keeping the alpha (mono color modes). */
function tintRaw(img: RawImage, [r, g, b]: [number, number, number]) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

/** Multiply the alpha channel by `opacity` in place. */
function applyOpacity(img: RawImage, opacity: number) {
  if (opacity >= 1) return;
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = Math.round(d[i] * opacity);
}

/** Blurred, offset, black copy of the warped logo's alpha — a contact shadow. */
async function buildShadow(
  warped: RawImage,
  spec: { blur: number; opacity: number; dx: number; dy: number },
  scale: number,
): Promise<RawImage> {
  const sigma = Math.max((spec.blur * scale) / 2, 0.3);
  const blurredAlpha = await sharp(Buffer.from(warped.data), {
    raw: { width: warped.width, height: warped.height, channels: 4 },
  })
    .extractChannel(3)
    .blur(sigma)
    .raw()
    .toBuffer();

  const out = Buffer.alloc(warped.width * warped.height * 4);
  const dx = Math.round(spec.dx * scale);
  const dy = Math.round(spec.dy * scale);
  for (let y = 0; y < warped.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= warped.height) continue;
    for (let x = 0; x < warped.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= warped.width) continue;
      const a = blurredAlpha[y * warped.width + x];
      if (a === 0) continue;
      out[(ty * warped.width + tx) * 4 + 3] = Math.round(a * spec.opacity);
    }
  }
  return { data: out, width: warped.width, height: warped.height, channels: 4 };
}

const edge = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export async function composeTemplate(
  template: Template2D,
  templateDir: string,
  logo: ComposeLogo,
  options: ComposeOptions = {},
): Promise<{ png: Buffer; metrics: ComposeMetrics }> {
  const t0 = performance.now();

  const outWidth = Math.min(Math.max(Math.round(options.width ?? DEFAULT_WIDTH), 320), MAX_WIDTH);
  const scale = outWidth / template.canvas.width;
  const outHeight = Math.round(template.canvas.height * scale);

  const readAsset = (rel: string) => readFile(path.join(templateDir, rel));
  const isSvgAsset = (rel: string) => /\.svg$/i.test(rel);

  // --- Stage -----------------------------------------------------------
  const tStage = performance.now();
  const stagePng = await (
    await rasterizeAsset(await readAsset(template.stage.src), isSvgAsset(template.stage.src), outWidth, outHeight)
  )
    .png()
    .toBuffer();
  const stageMs = performance.now() - tStage;

  // --- Placement geometry ----------------------------------------------
  const spec = template.surface.logo;
  const corners = template.surface.corners;
  const scaled = {
    tl: [corners.tl[0] * scale, corners.tl[1] * scale] as Point,
    tr: [corners.tr[0] * scale, corners.tr[1] * scale] as Point,
    br: [corners.br[0] * scale, corners.br[1] * scale] as Point,
    bl: [corners.bl[0] * scale, corners.bl[1] * scale] as Point,
  };
  const H = homographyFromUnitSquare(scaled);
  const surfaceW = (edge(scaled.tl, scaled.tr) + edge(scaled.bl, scaled.br)) / 2;
  const surfaceH = (edge(scaled.tl, scaled.bl) + edge(scaled.tr, scaled.br)) / 2;
  // Converts U-fractions into V-fractions. Baked surfaces carry their physical
  // aspect (curved surfaces foreshorten on camera, so px ratios would lie).
  const uvRatio = template.surface.uvWarp?.aspect ?? surfaceW / surfaceH;

  const aspect = await logoAspect(logo); // h/w
  let w = Math.min(
    Math.max(spec.placement.width * (options.logoScale ?? 1), spec.minWidth),
    spec.maxWidth,
  );
  // Clear space (in logo widths) and the logo box must fit inside the surface.
  const fitU = 1 / (w * (1 + 2 * spec.clearSpace));
  const fitV = 1 / (w * (aspect + 2 * spec.clearSpace) * uvRatio);
  w *= Math.min(1, fitU, fitV);
  const h = w * aspect * uvRatio;
  const clearU = spec.clearSpace * w;
  const clearV = spec.clearSpace * w * uvRatio;

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  const cx = clamp(spec.placement.cx + (options.offsetU ?? 0), clearU + w / 2, 1 - clearU - w / 2);
  const cy = clamp(spec.placement.cy + (options.offsetV ?? 0), clearV + h / 2, 1 - clearV - h / 2);

  const uvQuad: Point[] = [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
  const dstQuad = uvQuad.map(([u, v]) => applyMat3(H, u, v));

  // --- Logo rasterization ------------------------------------------------
  const tLogo = performance.now();
  const maxEdge = Math.max(edge(dstQuad[0], dstQuad[1]), edge(dstQuad[3], dstQuad[2]));
  const logoPxW = Math.round(clamp(maxEdge * SUPERSAMPLE, 32, MAX_LOGO_RASTER));
  const logoRaw = await rasterizeLogo(logo, logoPxW);
  const colorMode = options.colorMode ?? spec.colorMode ?? "original";
  if (colorMode !== "original") tintRaw(logoRaw, MONO_TINTS[colorMode]);
  const logoMs = performance.now() - tLogo;

  // --- Warp (baked uv field, or projection + displacement) ---------------
  const tWarp = performance.now();
  let warped: RawImage;
  if (template.surface.uvWarp) {
    const uw = template.surface.uvWarp;
    const uvMap = await loadUvMap(await readAsset(uw.src), outWidth, outHeight);
    const light = uw.light
      ? await loadRaw(
          await rasterizeAsset(await readAsset(uw.light), isSvgAsset(uw.light), outWidth, outHeight),
        )
      : undefined;
    warped = warpImageUv(logoRaw, {
      outWidth,
      outHeight,
      box: { u0: cx - w / 2, v0: cy - h / 2, u1: cx + w / 2, v1: cy + h / 2 },
      uvMap,
      light,
    });
  } else {
    let displacement: { image: RawImage; strength: number } | undefined;
    if (template.surface.displacement) {
      const d = template.surface.displacement;
      displacement = {
        image: await loadRaw(
          await rasterizeAsset(await readAsset(d.src), isSvgAsset(d.src), outWidth, outHeight),
        ),
        strength: d.strength * scale,
      };
    }
    const matrix: Mat3 = homographyFromPoints(
      [
        [0, 0],
        [logoRaw.width, 0],
        [logoRaw.width, logoRaw.height],
        [0, logoRaw.height],
      ],
      dstQuad,
    );
    warped = warpImage(logoRaw, { outWidth, outHeight, matrix, displacement });
  }
  applyOpacity(warped, spec.opacity ?? 1);
  const warpMs = performance.now() - tWarp;

  // --- Composite: stage → shadow → logo → lighting ------------------------
  const tComposite = performance.now();
  const layers: OverlayOptions[] = [];

  if (spec.shadow) {
    const shadow = await buildShadow(warped, spec.shadow, scale);
    layers.push({
      input: Buffer.from(shadow.data),
      raw: { width: shadow.width, height: shadow.height, channels: 4 },
      blend: "over",
    });
  }

  layers.push({
    input: Buffer.from(warped.data),
    raw: { width: warped.width, height: warped.height, channels: 4 },
    blend: spec.blend,
  });

  for (const layer of template.lighting ?? []) {
    layers.push(await lightingOverlay(layer, readAsset, isSvgAsset, outWidth, outHeight));
  }

  const png = await sharp(stagePng).composite(layers).png().toBuffer();
  const compositeMs = performance.now() - tComposite;

  return {
    png,
    metrics: {
      templateId: template.id,
      outWidth,
      outHeight,
      appliedWidth: w,
      logoRasterPx: { width: logoRaw.width, height: logoRaw.height },
      stageMs: Math.round(stageMs),
      logoMs: Math.round(logoMs),
      warpMs: Math.round(warpMs),
      compositeMs: Math.round(compositeMs),
      totalMs: Math.round(performance.now() - t0),
    },
  };
}

async function lightingOverlay(
  layer: LightingLayer,
  readAsset: (rel: string) => Promise<Buffer>,
  isSvgAsset: (rel: string) => boolean,
  w: number,
  h: number,
): Promise<OverlayOptions> {
  const raw = await loadRaw(
    await rasterizeAsset(await readAsset(layer.src), isSvgAsset(layer.src), w, h),
  );
  applyOpacity(raw, layer.opacity ?? 1);
  return {
    input: Buffer.from(raw.data),
    raw: { width: raw.width, height: raw.height, channels: 4 },
    blend: layer.blend,
  };
}
