import "server-only";

import sharp from "sharp";

import { UNMEASURED_MARK, type MarkGeometry } from "./optical";

// Reading a mark's own extent, and cutting the file down to it.
//
// docs/asset-normalization.md §11. The productised form of
// labs/freehand/scripts/normalize-marks.mjs, where three operations settled on
// real supplied artwork:
//
//   1. lift a white plate  — an opaque delivery becomes artwork on transparency
//   2. trim to the artwork — the alpha bounding box, not the file box
//   3. measure the ink     — so a row of marks can be balanced by weight
//
// Two of the three are MEASUREMENT and happen to every image at intake: they
// cost one bounded decode and they answer 「この素材は使いにくい形か」 without
// asking anybody. The third — writing a new file — happens only when a person
// says yes, and lands as a derived material beside the original (§15: 原本を
// 消さない).
//
// Image operations belong at intake, never as a draw-time filter. A CSS filter
// cannot cut a plate away: it has no alpha to work on, so `knockout` on an
// opaque raster paints the plate white along with the mark. That is the failure
// this module exists to remove (commit 1c95bdf).
//
// Nothing here asks a model. Where the artwork ends is a fact of the pixels.

/** Alpha below this is padding, not artwork. */
const ALPHA_FLOOR = 12;
/** Height the artwork is rasterised to before its extent is read. */
const MEASURE_HEIGHT = 800;
/**
 * How far from white counts as fully inked when a plate is lifted.
 *
 * Distance from white rather than brightness, so a light grey anti-aliased edge
 * keeps a proportional alpha and the mark's edges stay soft instead of being
 * cut to a hard silhouette. 340 over 255 means a mid grey is already opaque —
 * artwork, not background.
 */
const PLATE_GAIN = 340;
/**
 * How much the lift has to win by before it counts as a plate.
 *
 * Every opaque file is a candidate — a photograph has no alpha either — so the
 * test cannot be 「lifting changed something」. A dark photograph lifted off
 * white still covers its frame (0.99 instead of 1.00); a mark on a plate drops
 * to a fraction. Requiring a real fall keeps a photograph from being reported
 * as artwork on a plate.
 */
const PLATE_GAIN_FLOOR = 0.9;

/** Formats sharp can decode here. SVG rasterises, which measuring needs. */
const NORMALIZABLE = /^image\/(png|jpeg|webp|gif|avif|tiff|svg\+xml)$/;

export const isNormalizable = (mediaType: string | null | undefined): boolean =>
  typeof mediaType === "string" && NORMALIZABLE.test(mediaType);

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Artwork on an opaque white plate → artwork on transparency.
 *
 * Only ever applied to a file that has no usable alpha at all. Applying it to a
 * photograph with a white sky would eat the sky.
 */
async function liftFromWhitePlate(body: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(body, { failOn: "none" })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // 0 at pure white, 255 at full distance from it.
    const alpha = Math.min(255, Math.round(((255 - Math.min(r, g, b)) / 255) * PLATE_GAIN));
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = alpha;
  }
  return sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/** The smallest rectangle holding actual artwork, plus how much of it is ink. */
async function readExtent(
  body: Buffer,
): Promise<{ box: Box; inkRatio: number; frame: { width: number; height: number } } | null> {
  const { data, info } = await sharp(body, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  let ink = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha <= ALPHA_FLOOR) continue;
      ink += alpha;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  // Entirely transparent. Not an error — it is a file somebody will want to see
  // listed and told about, so it measures as unmeasured.
  if (right < 0) return null;
  const box = { left, top, width: right - left + 1, height: bottom - top + 1 };
  return {
    box,
    // Coverage inside the artwork's own box, which is what makes the number
    // intrinsic: the same mark exported with more padding measures the same.
    inkRatio: ink / 255 / (box.width * box.height),
    frame: { width, height },
  };
}

/**
 * Rasterise at a bounded, comparable size.
 *
 * SVG has no pixels until something asks for them, so density is raised for the
 * trim not to be quantised. Everything is brought to one height so that the
 * cost of measuring does not depend on what the user happened to upload.
 */
const rasterise = (body: Buffer) =>
  sharp(body, { failOn: "none", density: 600 })
    .resize({ height: MEASURE_HEIGHT, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

export interface MarkMeasurement extends MarkGeometry {
  /** Whether a white plate had to be lifted before the artwork could be found. */
  plate: boolean;
}

export const UNMEASURED_MARK_MEASUREMENT: MarkMeasurement = {
  ...UNMEASURED_MARK,
  plate: false,
};

/**
 * Where the artwork in this file actually is, and how much of it is ink.
 *
 * Interprets the file AS ARTWORK: alpha when there is any, distance from white
 * when there is none. That second reading is what lets intake say anything at
 * all about a mark delivered as a JPEG or an opaque webp — the case the whole
 * feature exists for — and it costs a photograph nothing, because a photograph
 * covers its frame either way and simply measures as full.
 *
 * The box comes back in the FILE's pixels, not the raster's, so it can be
 * compared with `width`/`height` on the row.
 *
 * Never throws. A file that cannot be decoded measures as unmeasured, because
 * an unreadable material is still a material (docs §6).
 */
export async function measureMark(
  body: Buffer,
  mediaType: string | null | undefined,
): Promise<MarkMeasurement> {
  if (!isNormalizable(mediaType)) return UNMEASURED_MARK_MEASUREMENT;
  try {
    const raster = await rasterise(body);
    let extent = await readExtent(raster);
    if (!extent) return UNMEASURED_MARK_MEASUREMENT;
    let plate = false;
    // No alpha to go on: read the file as artwork on a plate instead. A
    // photograph lands here too and measures full, which is the honest answer.
    const coversFrame =
      extent.box.width === extent.frame.width && extent.box.height === extent.frame.height;
    if (coversFrame && extent.inkRatio > 0.98) {
      const lifted = await readExtent(await liftFromWhitePlate(raster));
      if (lifted && lifted.inkRatio < extent.inkRatio * PLATE_GAIN_FLOOR) {
        extent = lifted;
        plate = true;
      }
    }

    // Back to the file's own scale, so trim_width/height and width/height are
    // measured in the same units. Rasterising at a fixed height otherwise makes
    // 「余白の割合」 compare two different rulers.
    const meta = await sharp(body, { failOn: "none" }).metadata();
    const frameWidth = typeof meta.width === "number" && meta.width > 0 ? meta.width : null;
    const frameHeight = typeof meta.height === "number" && meta.height > 0 ? meta.height : null;
    const scale = frameWidth && extent.frame.width > 0 ? frameWidth / extent.frame.width : 1;
    // Clamped to the file's own dimensions. The raster's aspect is the file's
    // only to the nearest pixel, and 0055 refuses artwork bigger than the frame
    // holding it — a rounding artefact must not become a failed upload.
    const scaled = (measured: number, frame: number | null) => {
      const value = Math.max(1, Math.round(measured * scale));
      return frame ? Math.min(frame, value) : value;
    };
    return {
      inkRatio: Number(extent.inkRatio.toFixed(4)),
      trimWidth: scaled(extent.box.width, frameWidth),
      trimHeight: scaled(extent.box.height, frameHeight),
      plate,
    };
  } catch {
    return UNMEASURED_MARK_MEASUREMENT;
  }
}

export interface NormalizedMark {
  /** The trimmed, plate-free artwork. Always PNG: it needs an alpha channel. */
  body: Buffer;
  mediaType: "image/png";
  width: number;
  height: number;
  /** The operations that were actually applied, for the row's provenance. */
  operations: Array<"plate" | "trim">;
}

/**
 * Make the normalised version of a mark.
 *
 * Runs only on approval, and returns null when there is nothing to do —
 * writing a byte-identical derivative would give the user two files and one
 * meaning.
 *
 * PNG regardless of what arrived, because the output's job is to have an alpha
 * channel: a trimmed JPEG would still be artwork on a plate.
 */
export async function normalizeMark(
  body: Buffer,
  mediaType: string | null | undefined,
): Promise<NormalizedMark | null> {
  if (!isNormalizable(mediaType) || mediaType === "image/svg+xml") return null;
  try {
    // Full resolution here, unlike measuring: this file is the one that gets
    // used, so it keeps every pixel the upload had.
    let working: Buffer = await sharp(body, { failOn: "none" }).png().toBuffer();
    const operations: Array<"plate" | "trim"> = [];

    const first = await readExtent(working);
    if (!first) return null;
    const coversFrame =
      first.box.width === first.frame.width && first.box.height === first.frame.height;
    let extent = first;
    if (coversFrame && first.inkRatio > 0.98) {
      const lifted = await liftFromWhitePlate(working);
      const liftedExtent = await readExtent(lifted);
      if (liftedExtent && liftedExtent.inkRatio < first.inkRatio * PLATE_GAIN_FLOOR) {
        working = lifted;
        extent = liftedExtent;
        operations.push("plate");
      }
    }
    if (
      extent.box.width !== extent.frame.width ||
      extent.box.height !== extent.frame.height
    ) {
      working = await sharp(working).extract(extent.box).png().toBuffer();
      operations.push("trim");
    }
    if (operations.length === 0) return null;

    const meta = await sharp(working).metadata();
    return {
      body: working,
      mediaType: "image/png",
      width: meta.width ?? extent.box.width,
      height: meta.height ?? extent.box.height,
      operations,
    };
  } catch {
    return null;
  }
}
