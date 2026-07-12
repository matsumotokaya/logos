// Projective mapping + warp — the deterministic heart of the 2D compositor.
// Pure TypeScript on raw RGBA buffers: no ImageMagick/OpenCV binary to deploy,
// and every pixel decision stays auditable. ~2M px per render is fine in JS.

import type { Point, SurfaceCorners } from "@/labs/workflow/core/template-format";

/** Row-major 3x3 homography matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export type RawImage = {
  data: Buffer | Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  /** 4 = RGBA (required for warp targets). */
  channels: number;
};

/** Solve A·x = b (n×n) via Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error("homography: singular system");
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = b[r];
    for (let c = r + 1; c < n; c++) sum -= a[r][c] * x[c];
    x[r] = sum / a[r][r];
  }
  return x;
}

/** Homography from 4 source points to 4 destination points (DLT, h9 = 1). */
export function homographyFromPoints(src: Point[], dst: Point[]): Mat3 {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

const UNIT_SQUARE: Point[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** Maps surface UV (0–1) to canvas coordinates through the corner quad. */
export function homographyFromUnitSquare(c: SurfaceCorners): Mat3 {
  return homographyFromPoints(UNIT_SQUARE, [c.tl, c.tr, c.br, c.bl]);
}

export function applyMat3(m: Mat3, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

export function invertMat3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("homography: non-invertible matrix");
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/** Bilinear RGBA sample; coordinates outside the source read as transparent. */
function sampleBilinear(src: RawImage, x: number, y: number, out: [number, number, number, number]) {
  if (x < 0 || y < 0 || x > src.width - 1 || y > src.height - 1) {
    out[0] = out[1] = out[2] = out[3] = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, src.width - 1);
  const y1 = Math.min(y0 + 1, src.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const d = src.data;
  const i00 = (y0 * src.width + x0) * 4;
  const i10 = (y0 * src.width + x1) * 4;
  const i01 = (y1 * src.width + x0) * 4;
  const i11 = (y1 * src.width + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = d[i00 + c] * (1 - fx) + d[i10 + c] * fx;
    const bot = d[i01 + c] * (1 - fx) + d[i11 + c] * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
}

export type WarpOptions = {
  /** Destination canvas size (px). */
  outWidth: number;
  outHeight: number;
  /** Maps source-image px → destination px. */
  matrix: Mat3;
  /**
   * Optional displacement map already sized outWidth×outHeight (RGBA raw):
   * R shifts x, G shifts y, 128 = neutral, at `strength` px full deflection.
   */
  displacement?: { image: RawImage; strength: number };
};

/**
 * Inverse-map warp of an RGBA source into a fresh transparent RGBA canvas.
 * Displacement is applied in destination space: dest px p samples the warped
 * logo at p + d(p), which visually bends the print into the surface wrinkles.
 */
export function warpImage(src: RawImage, opts: WarpOptions): RawImage {
  if (src.channels !== 4) throw new Error("warpImage: source must be RGBA");
  const { outWidth, outHeight } = opts;
  const inv = invertMat3(opts.matrix);
  const out = Buffer.alloc(outWidth * outHeight * 4);
  const disp = opts.displacement;
  const px: [number, number, number, number] = [0, 0, 0, 0];

  // Limit work to the projected quad's bounding box (plus displacement reach).
  const corners: Point[] = [
    applyMat3(opts.matrix, 0, 0),
    applyMat3(opts.matrix, src.width, 0),
    applyMat3(opts.matrix, src.width, src.height),
    applyMat3(opts.matrix, 0, src.height),
  ];
  const reach = disp ? Math.ceil(disp.strength) + 1 : 1;
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - reach);
  const maxX = Math.min(outWidth - 1, Math.ceil(Math.max(...corners.map((p) => p[0]))) + reach);
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - reach);
  const maxY = Math.min(outHeight - 1, Math.ceil(Math.max(...corners.map((p) => p[1]))) + reach);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let sx = x;
      let sy = y;
      if (disp) {
        const di = (y * disp.image.width + x) * 4;
        sx += ((disp.image.data[di] - 128) / 128) * disp.strength;
        sy += ((disp.image.data[di + 1] - 128) / 128) * disp.strength;
      }
      const w = inv[6] * sx + inv[7] * sy + inv[8];
      const u = (inv[0] * sx + inv[1] * sy + inv[2]) / w;
      const v = (inv[3] * sx + inv[4] * sy + inv[5]) / w;
      if (u < -1 || v < -1 || u > src.width || v > src.height) continue;
      sampleBilinear(src, u, v, px);
      if (px[3] < 1) continue;
      const oi = (y * outWidth + x) * 4;
      out[oi] = px[0];
      out[oi + 1] = px[1];
      out[oi + 2] = px[2];
      out[oi + 3] = px[3];
    }
  }
  return { data: out, width: outWidth, height: outHeight, channels: 4 };
}
