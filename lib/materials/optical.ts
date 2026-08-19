// What a mark's measurements MEAN: how big to draw it, and whether the file it
// arrived as is worth normalising.
//
// docs/asset-normalization.md §11. Two questions, both answered by arithmetic
// on measurements that are already on the row, which is why this module holds
// no sharp and no `server-only`: the screen decides what to offer with the same
// function the server uses to decide what to do, and a test can read both.
//
// Proven in the Freehand Lab (labs/freehand/scripts/normalize-marks.mjs), where
// four partner marks had to sit in one credit row. The constants below are that
// script's, unchanged — they were argued with against real artwork, and moving
// them without new artwork in front of you is guessing.

/** What was measured about a mark's own artwork, ignoring its padding. */
export interface MarkGeometry {
  /**
   * Alpha-weighted coverage inside the artwork's own bounding box, 0–1.
   *
   * Intrinsic to the mark: identical for a padded export and its trimmed
   * derivative, because the padding is outside the box being measured. A solid
   * wordmark reads around 0.30, a hairline calligraphic mark around 0.05, a
   * photograph 1.0.
   */
  inkRatio: number | null;
  /** The artwork's own bounding box, in the file's pixels. */
  trimWidth: number | null;
  trimHeight: number | null;
}

/** Nothing about the artwork's extent could be read. Not an error. */
export const UNMEASURED_MARK: MarkGeometry = {
  inkRatio: null,
  trimWidth: null,
  trimHeight: null,
};

/**
 * How hard to correct toward equal ink.
 *
 * 1.0 = equal ink area (a hairline mark becomes enormous), 0 = equal height (a
 * two-line lockup disappears). 0.5 is the halfway house that looked right on a
 * row of four and is the number to argue with when it does not.
 */
const CORRECTION = 0.5;
/** Nothing may end up more than this much bigger or smaller than the row. */
const SCALE_MIN = 0.78;
const SCALE_MAX = 1.5;
/** A very wide wordmark still may not eat the row. */
const MAX_WIDTH_RATIO = 4.6;

/** A mark as the row sees it: an id and the geometry measured at intake. */
export interface MeasuredMark extends MarkGeometry {
  id: string;
}

const aspectOf = (mark: MarkGeometry): number | null => {
  if (!mark.trimWidth || !mark.trimHeight) return null;
  return mark.trimWidth / mark.trimHeight;
};

/** Ink area the mark would carry if drawn at unit height. */
const inkArea = (mark: MarkGeometry): number | null => {
  const aspect = aspectOf(mark);
  if (aspect === null || mark.inkRatio === null || mark.inkRatio <= 0) return null;
  return mark.inkRatio * aspect;
};

/**
 * Per-mark size correction for one row of marks.
 *
 * A designer laying out a credit row does not match heights, they match ink: a
 * two-line lockup set to a one-line wordmark's height has letters half the size
 * and reads as the junior partner. Ink area grows with the square of height, so
 * the correction is a square root — damped, because full area-matching turns a
 * thin calligraphic mark into a giant.
 *
 * The reference is the MEDIAN area rather than the mean, so one outlier cannot
 * drag the whole row with it. That also means a row of one mark gets scale 1:
 * there is nothing to balance against, and inventing a correction would resize
 * artwork for no reason.
 *
 * Marks whose geometry was never measured are absent from the result rather
 * than defaulted to 1. `undefined` means 「測っていない」 and leaves the brief's
 * own value — possibly a human's — alone; writing 1 would silently overwrite it.
 */
export function opticalScales(marks: readonly MeasuredMark[]): Map<string, number> {
  const areas: Array<{ id: string; area: number; aspect: number }> = [];
  for (const mark of marks) {
    const area = inkArea(mark);
    const aspect = aspectOf(mark);
    if (area === null || aspect === null) continue;
    areas.push({ id: mark.id, area, aspect });
  }
  const scales = new Map<string, number>();
  if (areas.length < 2) return scales;

  const sorted = [...areas].map((entry) => entry.area).sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length / 2)];

  for (const entry of areas) {
    const raw = Math.pow(reference / entry.area, CORRECTION / 2);
    let scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw));
    // A wordmark whose corrected width would still run away gets pulled back.
    if (entry.aspect * scale > MAX_WIDTH_RATIO) scale = MAX_WIDTH_RATIO / entry.aspect;
    scales.set(entry.id, Number(scale.toFixed(3)));
  }
  return scales;
}

// ---------------------------------------------------------------------------
// Whether the file is worth normalising
// ---------------------------------------------------------------------------

/**
 * Below this share of the file box, the padding is doing damage.
 *
 * 0.7 is roughly 8% of dead space on every side, which is where trimming starts
 * to change how a mark sits in a layout. Measured against the real library
 * (2026-08-19, 45 files): the mark this feature exists for fills 8% of its
 * frame, and the nearest photograph fills 88%. A looser floor swept in stock
 * photographs whose edges happen to be pale, and an offer that fires on
 * photographs is an offer nobody reads.
 */
const MARGIN_FLOOR = 0.7;

/** What a row needs to hold for the proposal to be decidable. */
export interface NormalizableMaterial extends MarkGeometry {
  kind?: string | null;
  category?: string | null;
  media_type?: string | null;
  width?: number | null;
  height?: number | null;
  /** True when the artwork has no transparency: it arrived on a plate. */
  opaque?: boolean | null;
}

export interface NormalizationProposal {
  /** Whether to offer a normalised version. */
  propose: boolean;
  /** What the offer says, in the order it should be read. Empty = nothing to say. */
  reasons: string[];
  /** Share of the file box the artwork actually occupies, or null. */
  fill: number | null;
}

const NOTHING: NormalizationProposal = { propose: false, reasons: [], fill: null };

/** A file something has said is a mark — the media type never says it. */
const knownMark = (material: NormalizableMaterial): boolean =>
  material.kind === "logo" || material.category === "mark";

/**
 * Should we offer to make a normalised version of this file?
 *
 * Two independent triggers, and the difference between them is what the
 * measurements can and cannot decide on their own:
 *
 *   PADDING is self-evident. A frame that is 92% empty is not a photograph,
 *   whatever the row says it is, so the geometry alone may propose the trim.
 *   This is what catches a mark uploaded as `photo` — intake derives `kind`
 *   from the media type, so the partner logo delivered as an opaque webp
 *   arrives classified as a picture (docs §11).
 *
 *   A PLATE is not. `opaque` means "no alpha channel", which is equally true of
 *   every JPEG ever taken, and lifting a white background off a photograph
 *   would eat its sky. So the plate is only ever named when something has said
 *   this file is a mark — `kind='logo'`, or a person choosing 「マーク」 in the
 *   inventory — or when the padding already proved it, because artwork bounded
 *   inside an opaque frame IS artwork on a plate.
 *
 * Measured against the real library rather than argued about: with the loose
 * version of this rule, 9 of 45 files were offered and 7 of those were
 * photographs. With this one, the offer appears on the file it was written for.
 *
 * SVG is left alone. A vector mark has no pixel padding to cut — its viewBox is
 * the artwork — and rasterising it to trim would throw away the one delivery
 * format that scales.
 */
export function normalizationProposal(
  material: NormalizableMaterial,
): NormalizationProposal {
  if (material.media_type === "image/svg+xml") return NOTHING;

  const fill =
    material.width && material.height && material.trimWidth && material.trimHeight
      ? Number(
          ((material.trimWidth * material.trimHeight) / (material.width * material.height)).toFixed(
            3,
          ),
        )
      : null;
  const padded = fill !== null && fill < MARGIN_FLOOR;
  const plate = material.opaque === true && (padded || knownMark(material));

  const reasons: string[] = [];
  // Order is the order of consequence: a plate puts a white rectangle in the
  // film, padding only misaligns it.
  if (plate) reasons.push("白い地に載っています");
  if (padded) reasons.push(`余白が大きい（絵柄は${Math.round((fill as number) * 100)}%）`);
  return { propose: reasons.length > 0, reasons, fill };
}
