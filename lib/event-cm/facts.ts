import {
  EVENT_CM_GOAL,
} from "@/lib/pipeline/event-cm";
import type { EventCmBrief } from "@/remotion/event-cm/types";

// The facts a video is made of, as an editable list.
//
// This is the input surface, and it is deliberately the same list that sits
// under the preview saying where each value came from. A separate form would
// mean reading one screen and typing into another; here the thing that says
// "this date is a guess" is the thing you correct it in.
//
// The stance is different from a document that must not be wrong. This fills
// everything in confidently and then admits, in the open, which parts it made
// up — because the user is passive: they react to what appeared, they do not
// brief it. So there is no "XXX", and there is no empty state to stare at.
//
// Three operations, and no others:
//   edit      replace the value. Origin becomes `user` and no re-run overwrites it.
//   suppress  keep the field but take it off screen. A DECISION, not a gap.
//   restore   undo a suppression.

export type FactInput =
  /** One line of text. */
  | "text"
  /** Several lines, one per row — value lines, programme titles. */
  | "lines"
  /** Not editable here: an asset, changed by adding material. */
  | "asset"
  /** Not editable here: produced by a stage of its own. */
  | "generated";

export interface FactField {
  path: string;
  label: string;
  required: boolean;
  input: FactInput;
  /** Shown under the field when it needs saying. */
  hint?: string;
}

const INPUT_BY_PATH: Record<string, FactInput> = {
  title: "text",
  subtitle: "text",
  seriesLabel: "text",
  presenter: "text",
  valueLines: "lines",
  valueChip: "text",
  programs: "lines",
  guests: "generated",
  "schedule.date": "text",
  "schedule.time": "text",
  "schedule.venue": "text",
  "schedule.fee": "text",
  cta: "text",
  logos: "asset",
  "visuals.value": "asset",
  "visuals.inkArt": "asset",
  bgm: "asset",
  script: "generated",
  voice: "generated",
};

export const FACT_FIELDS: FactField[] = EVENT_CM_GOAL.map((field) => ({
  path: field.path,
  label: field.label,
  required: field.required,
  input: INPUT_BY_PATH[field.path] ?? "generated",
  ...(field.path === "guests"
    ? { hint: "人名は推測で埋めません。登壇者は自分で入れてください" }
    : {}),
}));

/** A value as it should read in the list. Never the raw JSON. */
export function previewOf(brief: EventCmBrief, path: string): string {
  switch (path) {
    case "valueLines":
      return brief.valueLines.join("");
    case "programs":
      return brief.programs.map((program) => program.title).join(" / ");
    case "guests":
      return brief.guests.map((guest) => guest.name).join("、");
    case "logos":
      return brief.logos.map((logo) => logo.name).join("、");
    case "visuals.value":
      return brief.visuals.value ? "写真あり" : "";
    case "visuals.inkArt":
      return brief.visuals.inkArt ? "あり" : "";
    case "bgm":
      return brief.bgm ? "あり" : "";
    case "script":
      return brief.script.scenes.length > 0
        ? brief.script.scenes.map((scene) => scene.text).join("").slice(0, 60)
        : "";
    case "voice":
      return brief.voice ? `${Math.round(brief.voice.track.totalMs / 1000)}秒` : "";
    default: {
      const value = readScalar(brief, path);
      return value ?? "";
    }
  }
}

/** The editable form of a value: one string per line for `lines`. */
export function editableValue(brief: EventCmBrief, path: string): string[] {
  switch (path) {
    case "valueLines":
      return [...brief.valueLines];
    case "programs":
      return brief.programs.map((program) => program.title);
    default:
      return [readScalar(brief, path) ?? ""];
  }
}

function readScalar(brief: EventCmBrief, path: string): string | null {
  switch (path) {
    case "title":
      return brief.title;
    case "subtitle":
      return brief.subtitle;
    case "seriesLabel":
      return brief.seriesLabel;
    case "presenter":
      return brief.presenter;
    case "valueChip":
      return brief.valueChip;
    case "schedule.date":
      return brief.schedule.date;
    case "schedule.time":
      return brief.schedule.time;
    case "schedule.venue":
      return brief.schedule.venue;
    case "schedule.fee":
      return brief.schedule.fee;
    case "cta":
      return brief.cta;
    default:
      return null;
  }
}

export const isEditable = (path: string): boolean => {
  const input = INPUT_BY_PATH[path];
  return input === "text" || input === "lines";
};

/**
 * Write an edited value back.
 *
 * Only the paths this file declares editable can be written. Returns null for
 * anything else, so a request naming an asset or a generated field is refused
 * rather than quietly ignored.
 */
export function applyFactEdit(
  brief: EventCmBrief,
  path: string,
  lines: string[],
): EventCmBrief | null {
  const clean = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  const first = clean[0] ?? "";

  switch (path) {
    case "title":
      return { ...brief, title: first };
    case "subtitle":
      return { ...brief, subtitle: first };
    case "seriesLabel":
      return { ...brief, seriesLabel: first };
    case "presenter":
      return { ...brief, presenter: first };
    case "valueChip":
      return { ...brief, valueChip: first || null };
    case "cta":
      return { ...brief, cta: first };
    case "valueLines":
      return { ...brief, valueLines: clean };
    case "programs":
      return { ...brief, programs: clean.map((title) => ({ title })) };
    case "schedule.date":
      return { ...brief, schedule: { ...brief.schedule, date: first } };
    case "schedule.time":
      return { ...brief, schedule: { ...brief.schedule, time: first } };
    case "schedule.venue":
      return { ...brief, schedule: { ...brief.schedule, venue: first || null } };
    case "schedule.fee":
      return { ...brief, schedule: { ...brief.schedule, fee: first || null } };
    default:
      return null;
  }
}

/**
 * Record who decided this value. An edit is never overwritten by a re-run.
 *
 * Also stamps the facts as changed, which is what lets the narration know it
 * is out of date: a corrected date that leaves the voice announcing the old
 * one is worse than no correction at all.
 */
export function markUserEdited(
  brief: EventCmBrief,
  path: string,
  now: string = new Date().toISOString(),
): EventCmBrief {
  return {
    ...brief,
    factsUpdatedAt: now,
    provenance: {
      ...(brief.provenance ?? {}),
      [path]: { origin: "user" },
    },
  };
}

/**
 * Take a field off screen without losing it.
 *
 * Distinct from empty on purpose. An empty venue is something nobody has
 * confirmed and belongs on the collection list; a suppressed venue is a
 * decision not to show one, and must stop being asked about.
 */
export function setSuppressed(
  brief: EventCmBrief,
  path: string,
  suppressed: boolean,
): EventCmBrief {
  const current = brief.provenance?.[path];
  const next = { ...(brief.provenance ?? {}) };
  if (suppressed) {
    next[path] = { ...(current ?? { origin: "user" }), note: SUPPRESSED_NOTE };
  } else if (current) {
    next[path] = { origin: current.origin };
  }
  return { ...brief, provenance: next };
}

/** Marker kept in the note so no schema change is needed for a boolean. */
export const SUPPRESSED_NOTE = "__suppressed__";

export const isSuppressed = (brief: EventCmBrief, path: string): boolean =>
  brief.provenance?.[path]?.note === SUPPRESSED_NOTE;

/** Paths the user has taken off screen. The renderer skips these. */
export const suppressedPaths = (brief: EventCmBrief): string[] =>
  Object.entries(brief.provenance ?? {})
    .filter(([, entry]) => entry.note === SUPPRESSED_NOTE)
    .map(([path]) => path);

/**
 * The brief as it should be drawn: suppressed fields emptied out.
 *
 * Emptying rather than flagging, because every component already knows what to
 * do with nothing — omit, or draw its designed substitute (components.ts
 * EMPTY_BEHAVIOUR). Teaching the renderer a second kind of absence would mean
 * touching seventeen components to express a decision the brief can express
 * on its own.
 */
export function applySuppression(brief: EventCmBrief): EventCmBrief {
  const paths = new Set(suppressedPaths(brief));
  if (paths.size === 0) return brief;

  const off = (path: string) => paths.has(path);
  return {
    ...brief,
    title: off("title") ? "" : brief.title,
    subtitle: off("subtitle") ? "" : brief.subtitle,
    seriesLabel: off("seriesLabel") ? "" : brief.seriesLabel,
    presenter: off("presenter") ? "" : brief.presenter,
    valueLines: off("valueLines") ? [] : brief.valueLines,
    valueChip: off("valueChip") ? null : brief.valueChip,
    programs: off("programs") ? [] : brief.programs,
    guests: off("guests") ? [] : brief.guests,
    cta: off("cta") ? "" : brief.cta,
    logos: off("logos") ? [] : brief.logos,
    bgm: off("bgm") ? null : brief.bgm,
    schedule: {
      ...brief.schedule,
      date: off("schedule.date") ? "" : brief.schedule.date,
      time: off("schedule.time") ? "" : brief.schedule.time,
      venue: off("schedule.venue") ? null : brief.schedule.venue,
      fee: off("schedule.fee") ? null : brief.schedule.fee,
    },
    visuals: {
      ...brief.visuals,
      value: off("visuals.value") ? null : brief.visuals.value,
      inkArt: off("visuals.inkArt") ? null : brief.visuals.inkArt,
    },
  };
}
