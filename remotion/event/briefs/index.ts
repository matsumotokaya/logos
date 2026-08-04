// Bundled EventBriefs — hand-authored briefs that can seed a new event video.
//
// These exist because the extraction/structuring pipeline that will write an
// EventBrief from raw client material (a Slack paste, a flyer, a folder of
// assets) isn't built yet. A bundled brief is a *seed*: creating a video copies
// it into that video's own `brand_assets.metadata`, which is the source of
// truth from then on. Editing a video never edits this file.

import type { EventBrief } from "../types";
import { sake2026Brief } from "./sake-2026";

export interface BundledBrief {
  slug: string;
  label: string;
  /** Where the wording and assets came from, shown when seeding. */
  provenance: string;
  brief: EventBrief;
}

export const BUNDLED_BRIEFS: BundledBrief[] = [
  {
    slug: "sake-2026",
    label: "世界が恋する日本酒（レオパレス21 × WealthPark Lab）",
    provenance: "企画者のSlackメッセージ + フライヤー + 支給素材（2026-08-04）",
    brief: sake2026Brief,
  },
];

export const bundledBrief = (slug: string): BundledBrief | null =>
  BUNDLED_BRIEFS.find((b) => b.slug === slug) ?? null;

/**
 * A brief with nothing in it but the title — every asset slot null, every fact
 * unset. The composition still renders a complete video from this, which is
 * the template's core requirement, so this is a legitimate starting point
 * rather than a broken state.
 */
export function emptyEventBrief(title: string): EventBrief {
  return {
    presenter: "",
    seriesLabel: "",
    title,
    subtitle: "",
    sideCopy: null,
    valueLines: [],
    valueChip: null,
    programsHeading: "プログラム",
    programs: [],
    guestsHeading: "ゲスト",
    guests: [],
    schedule: { date: "", weekday: "", time: "", venue: null, fee: null },
    cta: "詳細・お申し込みはこちら",
    footnote: null,
    logos: [],
    visuals: {
      inkArt: null,
      value: null,
      programs: null,
      closing: null,
      texture: null,
    },
    bgm: null,
  };
}
