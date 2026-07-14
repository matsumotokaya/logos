// UV-warp compositing — the curved-surface half of the deterministic engine.
//
// A baked uv map (16-bit PNG from the Blender pipeline) tells every canvas
// pixel which point of the printable surface it shows: R = u·coverage,
// G = v·coverage, B = coverage (premultiplied by render edge coverage, so
// u = R/B survives anti-aliased silhouettes). The logo is placed as a box in
// that surface UV space and sampled inversely per destination pixel, then the
// baked shading map multiplies real scene lighting into the print. Pure TS on
// raw buffers, same auditability rules as homography.ts.

import { sampleBilinear, type RawImage } from "./homography";

/** 16-bit raw image (native-endian ushort — sharp raw depth "ushort"). */
export type RawImage16 = {
  data: Uint16Array;
  width: number;
  height: number;
  /** 3 = RGB (sharp rgb16 pipeline), 4 = RGBA. */
  channels: number;
};

export type UvWarpRenderOptions = {
  outWidth: number;
  outHeight: number;
  /** Logo box in surface UV space. */
  box: { u0: number; v0: number; u1: number; v1: number };
  /** uv map already resized to outWidth×outHeight. */
  uvMap: RawImage16;
  /** Optional shading map (RGBA uchar) already resized to output. */
  light?: RawImage;
};

/** Below 1% coverage the recovered UV is too noisy to matter — skip. */
const MIN_COVERAGE = 655;

/**
 * Inverse-map the logo through the baked surface UV field into a fresh
 * transparent RGBA canvas. Coverage feathers the silhouette; the light map
 * multiplies baked scene shading into the print.
 */
export function warpImageUv(src: RawImage, opts: UvWarpRenderOptions): RawImage {
  if (src.channels !== 4) throw new Error("warpImageUv: source must be RGBA");
  const { outWidth, outHeight, uvMap, light, box } = opts;
  if (uvMap.width !== outWidth || uvMap.height !== outHeight)
    throw new Error("warpImageUv: uv map must match the output size");
  const spanU = box.u1 - box.u0;
  const spanV = box.v1 - box.v0;
  if (spanU <= 0 || spanV <= 0) throw new Error("warpImageUv: empty logo box");

  const out = Buffer.alloc(outWidth * outHeight * 4);
  const uv = uvMap.data;
  const stride = uvMap.channels;
  const px: [number, number, number, number] = [0, 0, 0, 0];

  for (let i = 0, n = outWidth * outHeight; i < n; i++) {
    const cov = uv[i * stride + 2];
    if (cov < MIN_COVERAGE) continue;
    const u = uv[i * stride] / cov;
    const v = uv[i * stride + 1] / cov;
    if (u < box.u0 || u > box.u1 || v < box.v0 || v > box.v1) continue;

    const lx = ((u - box.u0) / spanU) * (src.width - 1);
    const ly = ((v - box.v0) / spanV) * (src.height - 1);
    sampleBilinear(src, lx, ly, px);
    if (px[3] < 1) continue;

    let [r, g, b] = px;
    if (light) {
      const li = i * 4;
      r = (r * light.data[li]) / 255;
      g = (g * light.data[li + 1]) / 255;
      b = (b * light.data[li + 2]) / 255;
    }
    const oi = i * 4;
    out[oi] = r;
    out[oi + 1] = g;
    out[oi + 2] = b;
    out[oi + 3] = Math.round((px[3] * Math.min(cov, 65535)) / 65535);
  }
  return { data: out, width: outWidth, height: outHeight, channels: 4 };
}
