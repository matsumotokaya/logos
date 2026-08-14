import { archetypeFor, subjectFor } from "./archetypes";
import { defaultAsset } from "@/lib/assets/defaults";
import type { EventCmBrief, EventCmProvenance } from "@/remotion/event-cm/types";

// Hand someone a finished film before they have told us anything.
//
// Everything here is deterministic and free: no LLM, no render, no network.
// The brand's own values fill what they can, the archetype proposes the rest,
// and the default asset pool dresses what is left. What comes out is a
// complete EventCmBrief — the goal, on screen, in the brand's colours, one
// click after "add a video".
//
// Two rules hold the whole thing together:
//
//   1. **Every proposal is labelled.** provenance records `brand` for what the
//      brand actually has and `inferred` for what this file guessed, so the
//      screen can say which is which and publish can warn (§17.5).
//   2. **No invented people.** A guessed date is a proposal a user corrects in
//      five seconds. A guessed speaker is a fabricated person with a job
//      title. Guests seed empty, and the template omits the scene.

export interface SeedBrandInput {
  name: string;
  industry?: string | null;
  description?: string | null;
  /** Adopted palette, if the brand has one. Missing keys mean missing values. */
  palette?: { primary?: string; accent?: string; text?: string; background?: string };
  /** Adopted typography, if the brand has any. */
  headingFont?: string | null;
  bodyFont?: string | null;
  /** Something the renderer can load for the brand's mark, when one is ready. */
  logoSrc?: string | null;
}

const WEEKDAY_LABEL = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

/**
 * The first Friday at least four weeks out.
 *
 * Someone asking for an event video today is not running the event tomorrow;
 * they are preparing one, and preparation runs a month or two. Friday evening
 * is when this kind of gathering actually happens. Wrong for any given event,
 * right often enough to be worth proposing — and instantly correctable.
 */
export function proposedDate(now: Date): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() + 28);
  while (date.getDay() !== 5) date.setDate(date.getDate() + 1);
  return date;
}

const formatDate = (date: Date): string =>
  `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;

export function seedEventCmBrief(
  brand: SeedBrandInput,
  options: { now: Date; seed: string },
): EventCmBrief {
  const archetype = archetypeFor(brand);
  const subject = subjectFor(brand);
  const date = proposedDate(options.now);
  const provenance: EventCmProvenance = {};
  const inferred = (path: string, note?: string) => {
    provenance[path] = { origin: "inferred", note };
  };
  const fromBrand = (path: string) => {
    provenance[path] = { origin: "brand" };
  };

  // The brand supplies its own name; everything narrative is a proposal.
  fromBrand("presenter");
  inferred("title", `業種「${brand.industry ?? "—"}」から${archetype.kind}を想定`);
  inferred("subtitle");
  inferred("seriesLabel");
  inferred("valueLines");
  inferred("valueChip");
  inferred("programs", `${archetype.kind}の一般的な進行`);
  inferred("schedule.date", "今日から4週間後以降の最初の金曜日");
  inferred("schedule.time", `${archetype.kind}に多い開始時刻`);
  inferred("cta");

  // The one slot the pool can dress. A null here is not a hole: the composition
  // draws a designed substitute, which is the template's whole premise.
  //
  // Ink art and texture used to be seeded here too. Neither is drawn by any
  // event-cm scene — they were event-promo's, inherited by an `extends` that has
  // since been removed (remotion/event-cm/types.ts).
  const bgm = defaultAsset("bgm", archetype.tone);
  if (bgm) inferred("bgm", "デフォルトアセット");

  if (brand.logoSrc) fromBrand("logos");
  else inferred("logos", "ロゴ画像が未解決のため、明朝のクレジット表記で代替");

  // The brand's look, pinned. What it does not have keeps the theme's own —
  // and an absent accent is recorded as the tool's, not the brand's.
  const hasBrandLook = Boolean(
    brand.palette?.accent || brand.headingFont?.trim() || brand.bodyFont?.trim(),
  );
  if (hasBrandLook) fromBrand("theme");
  else inferred("theme", "ブランドの配色・書体が未採用のため、テーマの既定で描く");
  if (!brand.palette?.accent) {
    inferred("theme.accent", "このブランドはアクセントを持たないため、テーマの色を使う");
  }

  return {
    presenter: brand.name,
    seriesLabel: archetype.seriesLabel,
    title: archetype.titleFor(subject),
    subtitle: archetype.subtitle,
    valueLines: [...archetype.valueLines],
    valueChip: archetype.valueChip,
    programsHeading: `${archetype.programs.length}つのプログラム`,
    programs: archetype.programs.map((title) => ({ title })),
    guestsHeading: "登壇者",
    // Never invented. An empty list omits the scene; a fabricated name would
    // put a real-looking person on screen.
    guests: [],
    schedule: {
      date: formatDate(date),
      weekday: WEEKDAY_LABEL[date.getDay()],
      time: `${archetype.startHour}:00 START`,
      // Facts nobody has stated stay absent rather than becoming "未定".
      venue: null,
      fee: null,
    },
    cta: archetype.cta,
    footnote: null,
    logos: [{ name: brand.name, src: brand.logoSrc ?? null }],
    visuals: {
      value: null,
      programs: null,
      closing: null,
    },
    bgm: bgm?.src ?? null,
    theme: {
      palette: brand.palette,
      headingFont: brand.headingFont ?? null,
      bodyFont: brand.bodyFont ?? null,
    },
    provenance,
    // Written by the narration stage. Seeded empty so the brief is valid and
    // the goal reports the scenario as the one thing still missing.
    scenario: { version: 1, scenes: [], source: "llm", updatedAt: "", angle: "" },
  };
}
