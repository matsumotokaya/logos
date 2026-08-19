import "server-only";

import sharp from "sharp";

import { measureMark } from "./normalize";
import type { MarkGeometry } from "./optical";

// What a material IS, measured once at intake.
//
// docs/asset-normalization.md §6 / §14-1. These properties are true of the
// bytes regardless of which deliverable uses them, so they belong to the
// material's row — not to a run record, and not to a decision made again on
// every render.
//
// Until now they were measured inside the extract stage (lib/event-cm/extract.ts)
// and survived only in take_runs.steps. That is why the same JPEG had to be
// re-judged on every run, why the material list could not be filtered by what
// things are, and — when the judgement went wrong — why a logo was drawn as a
// white rectangle. Measuring is cheap and the answer never changes; storing it
// is the whole fix.
//
// Nothing here asks a model. Width, transparency and brightness are facts of
// the file, and a guess at a fact is worse than the fact.

export interface MaterialMeasurement extends MarkGeometry {
  /** Intrinsic pixel width, or null when the format has none we can read. */
  width: number | null;
  height: number | null;
  /**
   * Mean luminance of the non-transparent pixels, 0–1, or null when nothing
   * was opaque enough to measure.
   */
  luminance: number | null;
  /**
   * Whether the artwork has no transparency at all.
   *
   * Decisive for a mark, and separate from brightness: a logo delivered as a
   * JPEG is artwork ON A PLATE, and drawing it as supplied on an ink ground
   * puts a white rectangle in the film. Brightness cannot tell that apart from
   * a white mark on transparency, because both measure bright.
   */
  opaque: boolean | null;
}

/** Nothing could be measured. Not an error — audio and PDFs land here. */
export const UNMEASURED: MaterialMeasurement = {
  width: null,
  height: null,
  luminance: null,
  opaque: null,
  inkRatio: null,
  trimWidth: null,
  trimHeight: null,
};

/** Media types this module can read. Everything else measures as UNMEASURED. */
const MEASURABLE = /^image\/(png|jpeg|webp|gif|avif|tiff|svg\+xml)$/;

export const isMeasurable = (mediaType: string | null | undefined): boolean =>
  typeof mediaType === "string" && MEASURABLE.test(mediaType);

/**
 * The artwork's own brightness, and whether it has a plate behind it.
 *
 * Luminance is weighted by opacity — the mark's brightness, not the brightness
 * of the space around it. Opacity is counted at the same time because the two
 * questions have one answer only when read together: a white mark on
 * transparency and a black mark on a white JPEG plate both measure bright, and
 * on an ink ground they need opposite treatments.
 */
export async function measureArtwork(
  body: Buffer,
): Promise<{ luminance: number | null; opaque: boolean }> {
  try {
    const { data, info } = await sharp(body, { failOn: "none" })
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let total = 0;
    let counted = 0;
    let transparent = 0;
    for (let i = 0; i + 3 < data.length; i += info.channels) {
      const alpha = data[i + 3];
      if (alpha < 32) {
        transparent += 1;
        continue;
      }
      total += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      counted += 1;
    }
    return {
      luminance: counted > 0 ? Number((total / counted).toFixed(3)) : null,
      // A couple of stray soft pixels do not make artwork cut out; a real
      // transparent delivery is transparent over most of its frame.
      opaque: transparent / Math.max(1, transparent + counted) < 0.02,
    };
  } catch {
    return { luminance: null, opaque: true };
  }
}

/**
 * Measure an uploaded body for storage on its brand_materials row.
 *
 * Never throws. A material that cannot be decoded is still a material — it has
 * to be registered so the user can see it and say what it is — so failure
 * returns UNMEASURED rather than refusing the upload. Null means "we do not
 * know", which readers must treat differently from a measured value.
 */
export async function measureMaterial(
  body: Buffer,
  mediaType: string | null | undefined,
): Promise<MaterialMeasurement> {
  if (!isMeasurable(mediaType)) return UNMEASURED;
  try {
    const meta = await sharp(body, { failOn: "none" }).metadata();
    const artwork = await measureArtwork(body);
    // Where the artwork sits inside the frame, measured for every image rather
    // than for the ones we think are marks. `kind` at intake comes from the
    // media type, so the opaque webp of a partner's logo arrives as `photo` —
    // gating on kind would miss the exact upload §11 was written for. A
    // photograph simply measures as filling its frame, which costs nothing and
    // is true.
    const mark = await measureMark(body, mediaType);
    return {
      width: typeof meta.width === "number" && meta.width > 0 ? meta.width : null,
      height: typeof meta.height === "number" && meta.height > 0 ? meta.height : null,
      luminance: artwork.luminance,
      opaque: artwork.opaque,
      inkRatio: mark.inkRatio,
      trimWidth: mark.trimWidth,
      trimHeight: mark.trimHeight,
    };
  } catch {
    // sharp is built without a decoder for this format, or the file is broken.
    return UNMEASURED;
  }
}

/**
 * The measurement as brand_materials columns.
 *
 * Spread into an insert. Keys are always present so a re-measure overwrites a
 * stale value instead of leaving it behind.
 */
export const measurementColumns = (measurement: MaterialMeasurement) => ({
  width: measurement.width,
  height: measurement.height,
  opaque: measurement.opaque,
  luminance: measurement.luminance,
  ink_ratio: measurement.inkRatio,
  trim_width: measurement.trimWidth,
  trim_height: measurement.trimHeight,
});
