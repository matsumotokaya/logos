// Narrated event promo — the data contract.
//
// Same subject as `event-promo`, opposite spine. event-promo is a fixed 30s
// timeline (remotion/event/palette.ts EVENT_SCENES) that BGM and typography
// carry alone. Here the narration is written first and its timing decides the
// film: scene order comes from the script's roles, scene length from the TTS
// track, exactly as product-cm does (remotion/cm/CmComposition.tsx).
//
// The art direction does not change — ink black × gold × mincho, the treatment
// proven by 世界が恋する日本酒. So the brief is an EventBrief (facts, photos,
// logos, BGM, all of it) plus a script and, once fixed, a voice.
//
// Facts are still never invented (docs/deliverable-architecture.md §17.2): the
// narration may only speak what the brief already knows. A null venue is not
// narrated as "会場は後日発表" — it is simply not said.

import type { EventBrief } from "@/remotion/event/types";
import type { CmVoiceTrackOf } from "@/lib/campaign/cm-types";

/**
 * The five beats of an event narration, always in this order.
 *
 * product-cm's roles are a sales argument (hook → problem → solution →
 * features → cta). An announcement is not an argument: nobody has a problem
 * that an event solves. It has to earn attention, say what this is, say why it
 * is worth an evening, show what actually happens, and ask.
 */
export const EVENT_CM_SCENE_ROLES = [
  /** 誘い — one image or claim that buys the next five seconds. */
  "hook",
  /** 主題 — what this event is: series, host, title. */
  "theme",
  /** 価値 — why attend. The one promise the evening makes. */
  "value",
  /** 中身 — what actually happens: the programs, and who speaks. */
  "program",
  /** 行動 — when, and what to do. */
  "cta",
] as const;

export type EventCmSceneRole = (typeof EVENT_CM_SCENE_ROLES)[number];

export interface EventCmScene {
  role: EventCmSceneRole;
  /** Exactly the words read aloud. No headings, no stage directions. */
  text: string;
}

/**
 * Total narration budget. Not a hard limit on the render — the timeline is
 * whatever the voice turns out to be (§ the user's "ナレーション長ドリブン") —
 * but the number the writer is held to, so the result lands near 30 seconds.
 * Japanese TTS at CM pace runs roughly 7 characters per second.
 */
export const EVENT_CM_TARGET_SECONDS = 30;
export const EVENT_CM_MIN_CHARS = 180;
export const EVENT_CM_MAX_CHARS = 260;

/** Japanese CM narration pace. Only an estimate — the voice stage measures the
 *  real timeline — but enough to tell "about 30 seconds" from "45". */
export const EVENT_CM_CHARS_PER_SECOND = 7;

/**
 * How long each beat may run, in characters.
 *
 * Written down rather than left to the prompt because the screen is built on
 * it: a `program` beat at twice its budget is not a long sentence, it is a
 * twelve-second scene where eight were designed. Told to the writer AND
 * checked after, since a model asked for 62 characters returns 89.
 */
export const EVENT_CM_SCENE_BUDGET: Record<EventCmSceneRole, { min: number; max: number }> = {
  hook: { min: 25, max: 32 },
  theme: { min: 30, max: 40 },
  value: { min: 45, max: 55 },
  program: { min: 50, max: 62 },
  cta: { min: 35, max: 45 },
};

export const sceneChars = (scene: EventCmScene): number =>
  scene.text.replace(/\s/g, "").length;

/** Beats outside their budget, with the direction they went. Empty = on spec. */
export function scriptBudgetIssues(
  script: EventCmScript,
): Array<{ role: EventCmSceneRole; chars: number; over: boolean }> {
  return script.scenes.flatMap((scene) => {
    const budget = EVENT_CM_SCENE_BUDGET[scene.role];
    const chars = sceneChars(scene);
    if (chars >= budget.min && chars <= budget.max) return [];
    return [{ role: scene.role, chars, over: chars > budget.max }];
  });
}

export interface EventCmScript {
  version: 1;
  scenes: EventCmScene[];
  /** Who last wrote this text. A human edit is never silently regenerated. */
  source: "llm" | "human";
  updatedAt: string;
  /** The angle the writer committed to, in one line. Shown next to the script
   *  so a reader can tell whether the take is arguing the right thing before
   *  reading five paragraphs to find out. */
  angle: string;
}

/**
 * Where each field's value came from, keyed by the goal's field path
 * (lib/pipeline/event-cm.ts EVENT_CM_GOAL).
 *
 * The template hands the user a finished film before they have said anything,
 * so parts of it are the tool's proposal. That is only honest if the proposal
 * is labelled: a seeded date is not a fact this event has, it is a plausible
 * one offered for confirmation. Absent provenance means `user` — everything
 * written before this existed was authored by hand.
 */
export type EventCmProvenance = Record<
  string,
  { origin: "brand" | "extracted" | "inferred" | "user"; note?: string; source?: string }
>;

/**
 * The brand's own look, pinned into the take at creation.
 *
 * On the brief rather than fetched at render time for the same reason the
 * materials are: a take renders from what it fixed, so a palette adopted after
 * the fact cannot silently change a film somebody already approved.
 *
 * Absent values keep the theme's own — a brand with no accent is a real
 * answer, and the theme's gold stands in as the tool's proposal.
 */
export interface EventCmThemeInput {
  palette?: { primary?: string; accent?: string; background?: string; text?: string };
  headingFont?: string | null;
  bodyFont?: string | null;
}

/** Everything the narrated event video renders from. */
export interface EventCmBrief extends EventBrief {
  provenance?: EventCmProvenance;
  theme?: EventCmThemeInput;
  /**
   * When the facts last changed — a document was read, or somebody corrected
   * a value.
   *
   * Exists so the narration can be known to be out of date. The narration is
   * written FROM the facts, so a fact that changes after it was written means
   * the film is now saying something about a different event. Comparing
   * against `takes.updated_at` would not work: writing the script updates the
   * take too, so every script would immediately look current.
   */
  factsUpdatedAt?: string;
  script: EventCmScript;
  /** Present once the script has been spoken. Nothing waits for a human to
   *  approve the text: the golden path runs script → voice → film unattended,
   *  and editing is what you reach for after seeing the result, not before.
   *  `script.source` is what keeps a re-run from overwriting an edit. */
  voice?: {
    track: CmVoiceTrackOf<EventCmScene>;
    /** material:<uuid> of the mixed WAV, pinned through take_inputs. */
    audio: string;
  };
}

/**
 * Whether the narration still describes the facts it was written from.
 *
 * The narration is the film's spine — it decides the scene order and the scene
 * lengths — so a narration written before the facts changed does not merely
 * contain a stale sentence: the whole film is about a different event. This is
 * what went wrong when reading a flyer changed the title and left the voice
 * announcing the seeded proposal.
 */
export function scriptIsStale(brief: EventCmBrief): boolean {
  if (brief.script.scenes.length === 0) return false;
  if (!brief.factsUpdatedAt) return false;
  return brief.script.updatedAt < brief.factsUpdatedAt;
}

export const scriptText = (script: EventCmScript): string =>
  script.scenes.map((scene) => scene.text).join("");

export const scriptChars = (script: EventCmScript): number =>
  scriptText(script).replace(/\s/g, "").length;
