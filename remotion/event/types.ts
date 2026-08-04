// Event promo video contract — the first non-product template axis
// (events / seminars). An EventBrief is the structured data a video is
// rendered from; today it is authored by hand from raw client material
// (Slack paste + flyer + a drop folder of assets), and the extraction/
// structuring pipeline will produce it later.
//
// Every asset field is a slot: a staticFile() name (or URL) when the file
// exists, null to fall back to a *designed* treatment — never an empty dummy
// box. Facts (dates, names, venue) are never invented by the renderer: a null
// fact is elegantly omitted.

/** A photo plus how to frame it. Client photos are rarely composed for the
 *  slot they land in, so framing is data, not a hand-crop. */
export interface EventPhoto {
  /** staticFile name or URL. */
  src: string;
  /** Point of interest as 0..1 fractions of the source (a face, the glass).
   *  Defaults to the centre. In a medallion this point is placed exactly at
   *  the centre; in a full-bleed scene it drives object-position. */
  focus?: { x: number; y: number };
  /** Extra magnification beyond "cover". Needed for portrait medallions cut
   *  from landscape frames, where cover alone leaves the face small and high. */
  zoom?: number;
}

/**
 * How a logo file must be treated to sit on the ink canvas.
 * - `light`: already light-on-transparent — used as-is (the ideal delivery).
 * - `invert`: a single dark colour on transparent (e.g. a black-only SVG),
 *   inverted at render time so it reads as light.
 * Opaque logos on a white plate are knocked out ahead of time by
 * labs/event/scripts/prepare-assets.mjs and arrive here as `light`.
 */
export type LogoTreatment = "light" | "invert";

export interface EventLogo {
  name: string;
  /** staticFile name or URL; null = typographic fallback. */
  src: string | null;
  treatment?: LogoTreatment;
  /** Per-logo optical size correction — logotypes and square seals never
   *  balance at one shared height. Multiplies the row's base height. */
  scale?: number;
}

export interface EventGuest {
  name: string;
  role: string;
  /** null = monogram medallion fallback. */
  photo: EventPhoto | null;
}

export interface EventProgram {
  /** Displayed next to a large serif numeral (01/02/03). */
  title: string;
}

export interface EventSchedule {
  /** e.g. "2026.10.2" — display string, already formatted. */
  date: string;
  /** e.g. "FRI" */
  weekday: string;
  /** e.g. "17:00 START" */
  time: string;
  /** null = omitted (not "TBD" on screen). */
  venue: string | null;
  fee: string | null;
}

/**
 * Scene-level visual slots. These are placements, not one hero image: the
 * same idea as the presentation asset catalog's placements, so a future
 * editor can swap what fills each one without touching the composition.
 */
export interface EventVisuals {
  /** Ink calligraphy laid behind the title as a drifting watermark
   *  (light-on-transparent PNG). */
  inkArt: string | null;
  /** Full-bleed photo behind the value scene. */
  value: EventPhoto | null;
  /** Full-bleed photo behind the programs list, heavily dimmed. */
  programs: EventPhoto | null;
  /** Full-bleed photo behind the closing card. */
  closing: EventPhoto | null;
  /** Barely-visible texture over the opening, for grain rather than imagery. */
  texture: string | null;
}

export interface EventBrief {
  /** Scene 1 — who presents this. e.g. "レオパレス21 × WealthPark Lab" */
  presenter: string;
  /** e.g. "「文化資本と投資」シリーズ 第3弾" */
  seriesLabel: string;
  title: string;
  subtitle: string;
  /** Vertical side copy on the title scene (和組み). */
  sideCopy: string | null;
  /** Scene 3 — the single strongest value, one line per array entry. */
  valueLines: string[];
  /** Small gold chip under the value lines. */
  valueChip: string | null;
  programsHeading: string;
  programs: EventProgram[];
  guestsHeading: string;
  guests: EventGuest[];
  schedule: EventSchedule;
  cta: string;
  /** Small print on the closing scene, e.g. age restriction. */
  footnote: string | null;
  logos: EventLogo[];
  visuals: EventVisuals;
  /** staticFile name or URL of the BGM track; null = silent. */
  bgm: string | null;
}
