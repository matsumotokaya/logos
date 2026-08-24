import { archetypeFor, subjectFor } from "./archetypes";
import { templateBgm, templatePortrait, templateVisual } from "@/lib/assets/defaults";
import { currentTemplate } from "@/lib/templates/catalog";
import { eventCmNarratedSteps } from "@/remotion/event-cm/types";
import type {
  EventCmBrief,
  EventCmProvenance,
  EventCmNarration,
  EventCmSceneRole,
} from "@/remotion/event-cm/types";
import { NEW_FILM_THEME_ID } from "@/remotion/kit/theme";

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
//      title, so guests get a ROLE and never a name. The scene itself is not
//      optional (EVENT_CM_SCENES is fixed), and the role carries a stock
//      portrait marked 「（見本）」 — see `portrait()` below for why a face is
//      the one guess that needs saying out loud.

export interface SeedBrandInput {
  name: string;
  industry?: string | null;
  description?: string | null;
  /** Adopted palette, if the brand has one. Missing keys mean missing values. */
  palette?: { primary?: string; accent?: string; text?: string; background?: string };
  /** Adopted typography, if the brand has any. */
  headingFont?: string | null;
  bodyFont?: string | null;
  /**
   * The brand's mark, WITH what was measured about it.
   *
   * One field rather than a bare `logoSrc`, because the two were separable and
   * got separated: the promoter measured the artwork, wrote the result to
   * `brand_materials`, returned only the id, and the brief went out with no
   * measurement at all. The renderer then had to guess, guessed "opaque", and
   * drew a near-black SVG unchanged on the ink ground.
   *
   * Absent measurements are still legal — a caller may genuinely not know — and
   * `markPainting` handles that safely. What is no longer possible is passing
   * artwork while forgetting that a measurement exists.
   */
  logo?: {
    src: string;
    /** `null` = not measured. Never taken to mean opaque. */
    opaque?: boolean | null;
    luminance?: number | null;
  } | null;
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
  inferred("guests", "登壇者は役割と見本写真を仮置き。氏名は提案しません");
  inferred("narration", "テンプレートの下書き。資料を読むと書き直されます");

  // The one slot the pool dresses. A null here is not a hole: the composition
  // draws a designed substitute, which is the template's whole premise.
  //
  // Ink art and texture used to be seeded here too. Neither is drawn by any
  // event-cm scene — they were event-promo's, inherited by an `extends` that has
  // since been removed (remotion/event-cm/types.ts).
  //
  // THE TEMPLATE'S TRACK, not the brand's industry's. This used to read
  // `defaultAsset("bgm", archetype.tone)`, which made the music a consequence
  // of what business the customer is in — two event videos could open
  // differently for a reason nobody chose, and the brand had no say either.
  // Every new take of this template now starts with the same one
  // (lib/templates/catalog.ts, `defaultBgm`).
  const template = currentTemplate("event-cm");
  const bgm = templateBgm(template?.defaultBgm);
  if (bgm) inferred("bgm", "テンプレートの既定BGM");

  // The visual slots, one tier further down the same ladder.
  //
  //   1. the brand's own picture — brands arrive with a logo and a palette,
  //      almost never with photography, so this is usually empty
  //   2. the template's stock picture — here, and empty until the artwork lands
  //   3. the composition's designed substitute — an ink ground and gold
  //      particles, which is a finished frame, not a hole
  //
  // Tier 3 is why this can be empty and the film still complete. That premise
  // is what lets the pool grow later without touching a template.
  const visual = (path: string) => {
    const asset = templateVisual(template?.defaultVisuals?.[path]);
    if (asset) inferred(path, "テンプレートの既定画像");
    return asset ? { src: asset.src } : null;
  };

  // A SAMPLE FACE, and the film says so in the name beside it.
  //
  // The rest of this seeder guesses freely because a wrong guess is corrected
  // in five seconds. A face is the exception: nobody can tell by looking that
  // it was guessed, so a stock portrait beside a plausible name is the one
  // place this tool could be mistaken for a record of a real event.
  //
  // The answer is not to withhold the picture. A speaker scene carried by
  // monograms undersells what the template can do, and 「ゲストスピーカー」's
  // monogram is its first character — 「ゲ」, which reads as a truncated word
  // rather than an initial. So: show the photograph, and mark it 「（見本）」
  // where a viewer is already looking. Names are still never invented — this
  // is a role with a caveat, not a person.
  //
  // Deliberately a weaker guard than it could be, at this stage. The point of
  // the demo is that somebody sees their own event, rendered better than they
  // expected, and nothing later happens if that does not land. If the label
  // turns out to confuse more than it protects, it comes off — the decision
  // lives here and in catalog.ts, nowhere else.
  const portrait = (path: string) => {
    const asset = templatePortrait(template?.defaultVisuals?.[path]);
    if (asset) inferred(path, "テンプレートの見本写真");
    return asset ? { src: asset.src } : null;
  };

  // NO DUMMY MARK HERE, even though the pool has four.
  //
  // This is where the seeder stops guessing, and the line is not arbitrary: a
  // photograph of a tea room claims nothing about anybody, a sample face is
  // labelled 「（見本）」 beside it, but a MARK shown next to a company's name
  // reads as that company's identity — a trademark-shaped claim, and not one
  // anybody corrects in five seconds.
  //
  // The typographic credit is the designed answer, not a hole: 「ロゴなし→
  // 明朝のクレジット表記」 is the fallback this art direction was built with.
  // The pool's marks are there for fixtures (scripts/compare-art-directions.ts)
  // and for a user to choose, not for this function to assign.
  if (brand.logo) fromBrand("logos");
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

  const brief: EventCmBrief = {
    presenter: brand.name,
    seriesLabel: archetype.seriesLabel,
    title: archetype.titleFor(subject),
    subtitle: archetype.subtitle,
    valueLines: [...archetype.valueLines],
    valueChip: archetype.valueChip,
    programsHeading: `${archetype.programs.length}つのプログラム`,
    programs: archetype.programs.map((title) => ({ title })),
    guestsHeading: "登壇者",
    // Roles, never names.
    //
    // The speaker picture is part of the template now (EVENT_CM_SCENES), so an
    // empty list would open the film's fifth picture with nothing on it. A
    // guessed DATE is a proposal somebody corrects in five seconds; a guessed
    // NAME is a person who does not exist, and place-images.ts will attach a
    // real photograph to it the moment the caption seems to match — a made-up
    // name wearing a real face. A role says the same structural thing ("two
    // people speak here") and names nobody.
    guests: [
      { name: "ゲストスピーカー（見本）", role: "", photo: portrait("guests.0.photo") },
      { name: "モデレーター（見本）", role: "", photo: portrait("guests.1.photo") },
    ],
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
    logos: [
      {
        name: brand.name,
        src: brand.logo?.src ?? null,
        // Carried, not recomputed. The renderer derives the treatment from
        // these (remotion/kit/mark.ts) and cannot read the database.
        ...(brand.logo?.opaque === undefined ? {} : { opaque: brand.logo.opaque }),
        ...(brand.logo?.luminance === undefined
          ? {}
          : { luminance: brand.logo.luminance }),
      },
    ],
    visuals: {
      value: visual("visuals.value"),
      programs: visual("visuals.programs"),
      closing: visual("visuals.closing"),
    },
    bgm: bgm?.src ?? null,
    // The art direction belongs to the TEMPLATE, not to "a new film".
    //
    // `variant` in the catalog IS the art direction, and this template's is
    // モダンジャパニーズ — the very thing the user picked in the add dialog.
    // Seeding a global default instead meant asking for 和モダン and being handed
    // a white corporate film, with no switch anywhere to correct it.
    //
    // `NEW_FILM_THEME_ID` answers a different question: what a template that has
    // NOT declared a painting should fall to. event-cm has declared one
    // (`defaultRenders`, `theme: "sumi"`), so the declaration wins.
    artDirection: template?.defaultRenders[0]?.theme ?? NEW_FILM_THEME_ID,
    theme: {
      palette: brand.palette,
      headingFont: brand.headingFont ?? null,
      bodyFont: brand.bodyFont ?? null,
    },
    provenance,
    narration: { version: 1, scenes: [], source: "llm", updatedAt: "", angle: "" },
  };
  // Filled last, because which lines a film needs is a question about the film.
  return { ...brief, narration: draftNarration(brief, options.now) };
}

/**
 * A line for every picture that speaks, before anyone has written one.
 *
 * The narration is what the film is built on — it decides each scene's length,
 * its subtitles, and what the voice reads — so a take seeded without one is a
 * take seeded without its spine. It used to start empty, which made 「追加した
 * 瞬間に完成した映像が再生される」 true of the PICTURES and false of the words.
 *
 * These lines say what their scene is FOR and state no facts. That distinction
 * is the whole reason they are safe to speak aloud: a seeded date sits in the
 * fact list wearing a 「仮に入れた値」 label, but a subtitle has no label on it
 * — 「9月18日、渋谷でお待ちしています」 would read as an announcement, while
 * 「開催日と会場を、最後にここでお伝えします」 reads as a draft (README
 * 「捏造の方針」). Lengths sit inside each scene's budget, so the seeded film
 * runs at roughly the length the written one will.
 *
 * `source: "llm"`, not `"human"`: this is a draft, and the mapping stage must
 * replace it without being asked twice.
 */
const DRAFT_LINES: Partial<Record<EventCmSceneRole, string>> = {
  title: "はじめに、このイベントの名前と主旨をお伝えします。",
  value:
    "参加する理由をここでお伝えします。この時間で何が得られるのかを、ひとことでまとめる場所です。",
  guests: "当日お話しいただく方について、ここでご紹介する場所です。",
  cta: "開催日と会場、お申し込みの方法を、最後にここでお伝えします。",
};

const DRAFT_PROGRAM_LINES = [
  "当日の流れをご紹介します。ひとつめのプログラムについて、ここで話す場所です。",
  "ふたつめのプログラムについて、ここで話す場所です。",
  "みっつめのプログラムについて、ここで話す場所です。",
];

function draftNarration(brief: EventCmBrief, now: Date): EventCmNarration {
  return {
    version: 1,
    scenes: eventCmNarratedSteps(brief).map((step) => ({
      role: step.role,
      ...(step.index === undefined ? {} : { index: step.index }),
      text:
        step.role === "program"
          ? (DRAFT_PROGRAM_LINES[step.index ?? 0] ??
            DRAFT_PROGRAM_LINES[DRAFT_PROGRAM_LINES.length - 1])
          : (DRAFT_LINES[step.role] ?? ""),
    })),
    source: "llm",
    updatedAt: now.toISOString(),
    angle: "テンプレートの下書き。資料を読むと書き直されます",
  };
}
