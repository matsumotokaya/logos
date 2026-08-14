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
 * The film, scene by scene, always in this order.
 *
 * One message per picture, and one line of narration per picture. That single
 * rule is what the earlier version got wrong: `program` produced two pictures
 * from one line, so a sentence ran across a cut and the storyboard and the film
 * disagreed about how many times the screen changes. A presentation does not
 * put one message on two slides, and neither should this.
 *
 * The film opens and closes on the presenter's mark. Those two are silent: the
 * opening exists so the viewer knows whose film this is before anyone speaks,
 * and the close exists so they remember. Everything between them is narrated,
 * and the narration begins with the title call — an announcement names itself
 * first, rather than teasing and then explaining what was being teased.
 *
 * product-cm's roles are a sales argument (hook → problem → solution →
 * features → cta). An announcement is not an argument: nobody has a problem
 * that an event solves. It says whose it is, what it is, why it is worth an
 * evening, what happens, who speaks, and when.
 */
export const EVENT_CM_SCENES = [
  /** 提供 — the presenter's mark, alone. Music only. */
  { role: "logoIn", narrated: false, optional: false },
  /** 主題 — the title screen, and the narration that calls it. */
  { role: "title", narrated: true, optional: false },
  /** 価値 — why attend. The one promise the evening makes. */
  { role: "value", narrated: true, optional: false },
  /** 中身 — what actually happens. */
  { role: "program", narrated: true, optional: false },
  /** 登壇 — who speaks. Dropped entirely when nobody is announced: a picture
   *  with no people in it is not a speaker line-up, and a narration line about
   *  guests who do not exist is worse than silence. */
  { role: "guests", narrated: true, optional: true },
  /** 行動 — when, where, and what to do. */
  { role: "cta", narrated: true, optional: false },
  /** 余韻 — the mark again, fading. Music only. */
  { role: "logoOut", narrated: false, optional: false },
] as const;

export type EventCmSceneRole = (typeof EVENT_CM_SCENES)[number]["role"];

/** Every scene the template can produce, in film order. */
export const EVENT_CM_SCENE_ROLES = EVENT_CM_SCENES.map(
  (scene) => scene.role,
) as readonly EventCmSceneRole[];

/** The roles that carry a narration line, for any brief. */
export const EVENT_CM_NARRATED_ROLES = EVENT_CM_SCENES.filter(
  (scene) => scene.narrated,
).map((scene) => scene.role) as readonly EventCmSceneRole[];

export interface EventCmScene {
  role: EventCmSceneRole;
  /**
   * Which item this picture is about, when its role repeats.
   *
   * Only `program` repeats today: an evening with three programmes gets three
   * pictures, one each, because "one message per picture" applies to programmes
   * as much as to anything else — a numbered list of three is three messages
   * crammed onto one slide, and the narration line for it can only say
   * 「いろいろあります」. Absent when the role appears once, which keeps every
   * single-programme take exactly as it was.
   */
  index?: number;
  /** Exactly the words read aloud. No headings, no stage directions. */
  text: string;
}

/**
 * One picture in the film: a role, and which item it is about.
 *
 * This is what replaced "a scene IS a role". The moment a role can appear more
 * than once, everything that has to agree about the film — the timeline, the
 * captions, the storyboard panel, the line of narration — has to agree about
 * WHICH picture, and the role alone stopped being able to say.
 */
export interface EventCmSceneStep {
  role: EventCmSceneRole;
  narrated: boolean;
  index?: number;
}

/** The stable identity of one picture. Used as a map key wherever two parts of
 *  the system have to be talking about the same scene. */
export const eventCmSceneKey = (scene: {
  role: EventCmSceneRole;
  index?: number;
}): string => (scene.index === undefined ? scene.role : `${scene.role}#${scene.index}`);

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
  // Silent. Their length is fixed by the timeline, not by anything written.
  logoIn: { min: 0, max: 0 },
  logoOut: { min: 0, max: 0 },
  title: { min: 24, max: 34 },
  value: { min: 40, max: 52 },
  program: { min: 38, max: 50 },
  guests: { min: 26, max: 36 },
  cta: { min: 30, max: 42 },
};

export const sceneChars = (scene: EventCmScene): number =>
  scene.text.replace(/\s/g, "").length;

/**
 * How long one picture's line may be.
 *
 * Per scene rather than per role, because a role that repeats does less work
 * each time: one programme per picture is a shorter sentence than a summary of
 * three, and three pictures at the single-scene budget would add ninety
 * characters to the film. The first programme picture gets more room because it
 * also says what the set of them adds up to.
 */
export function eventCmSceneBudget(scene: {
  role: EventCmSceneRole;
  index?: number;
}): { min: number; max: number } {
  if (scene.role === "program" && scene.index !== undefined) {
    return scene.index === 0 ? { min: 30, max: 58 } : { min: 18, max: 40 };
  }
  return EVENT_CM_SCENE_BUDGET[scene.role];
}

/**
 * The scenes this particular brief produces, in film order.
 *
 * Optional scenes are decided by the facts, not by the writer: with nobody
 * announced there is no speaker picture and no speaker line, so the script is
 * four beats instead of five. Anything that walks the film — timeline, captions,
 * storyboard, the narration prompt — asks this rather than assuming the full
 * list, which is what keeps them agreeing with each other.
 */
/**
 * Marker kept in a field's provenance note when the user takes it off screen.
 *
 * Lives here, at the bottom of the stack, because the SHAPE of the film depends
 * on it: a suppressed speaker list means there is no speaker picture. Anything
 * that asks "what does this film consist of" therefore has to be able to see
 * it, including modules that must not import the editing layer.
 */
export const EVENT_CM_SUPPRESSED_NOTE = "__suppressed__";

type PlanInput = Pick<EventBrief, "guests" | "programs"> & {
  provenance?: EventCmProvenance;
};

const isOff = (brief: PlanInput, path: string): boolean =>
  brief.provenance?.[path]?.note === EVENT_CM_SUPPRESSED_NOTE;

/**
 * The pictures this brief produces, in film order.
 *
 * Reads suppression itself rather than trusting the caller to have emptied the
 * brief first. That was the bug behind a warning nobody could clear: the film
 * was drawn from the suppressed brief (no speaker picture, six narrated lines)
 * while `scriptIsStale` was computed from the stored one (speakers present,
 * seven lines expected) — so a correct, freshly written and recorded narration
 * was reported as out of date for ever.
 */
export function eventCmScenePlan(brief: PlanInput): EventCmSceneStep[] {
  const steps: EventCmSceneStep[] = [];
  const programs = isOff(brief, "programs") ? [] : brief.programs;
  const guests = isOff(brief, "guests") ? [] : brief.guests;

  for (const scene of EVENT_CM_SCENES) {
    if (scene.optional && !(scene.role === "guests" && guests.length > 0)) {
      continue;
    }
    // One picture per programme, when there is more than one. A single
    // programme keeps a single unindexed scene, so nothing changes for takes
    // that already exist — and an evening with nothing listed still gets its
    // programme picture, which then stands on its heading alone.
    if (scene.role === "program" && programs.length > 1) {
      programs.forEach((_, index) => {
        steps.push({ role: "program", narrated: true, index });
      });
      continue;
    }
    steps.push({ role: scene.role, narrated: scene.narrated });
  }
  return steps;
}

/** The pictures this brief needs a narration line for, in film order. */
export const eventCmNarratedSteps = (
  brief: Pick<EventBrief, "guests" | "programs">,
): EventCmSceneStep[] => eventCmScenePlan(brief).filter((scene) => scene.narrated);

/** The roles those pictures use. May repeat — three programmes are three
 *  `program` lines — so this answers "how many" and never "which one". */
export const eventCmNarratedRoles = (
  brief: Pick<EventBrief, "guests" | "programs">,
): EventCmSceneRole[] => eventCmNarratedSteps(brief).map((scene) => scene.role);

/** Beats outside their budget, with the direction they went. Empty = on spec. */
export function scriptBudgetIssues(
  script: EventCmScript,
): Array<{ role: EventCmSceneRole; chars: number; over: boolean }> {
  return script.scenes.flatMap((scene) => {
    const budget = eventCmSceneBudget(scene);
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
  /**
   * A proposed video name the user turned down.
   *
   * Only exists so the offer to rename does not come back on every load. Held
   * on the brief rather than in the browser because "I already answered this"
   * is a fact about the take, not about the machine that asked.
   */
  titleDeclined?: string | null;
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
/**
 * Why the narration and the film disagree, when they do.
 *
 * Two different problems, and telling them apart matters because the fix is
 * different. `shape` means the film gained or lost a picture and the script has
 * the wrong set of lines; `facts` means the words are about an older version of
 * the same event. The single boolean said 「変わる前の内容を読み上げています」 for
 * both, which was wrong for the first case and unfixable when the comparison
 * itself was wrong.
 */
export type ScriptStaleness = "shape" | "facts" | null;

export function scriptStaleness(brief: EventCmBrief): ScriptStaleness {
  if (brief.script.scenes.length === 0) return null;
  const expected = eventCmNarratedSteps(brief).map(eventCmSceneKey);
  const actual = brief.script.scenes.map(eventCmSceneKey);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    return "shape";
  }
  if (!brief.factsUpdatedAt) return null;
  return brief.script.updatedAt < brief.factsUpdatedAt ? "facts" : null;
}

export const scriptIsStale = (brief: EventCmBrief): boolean =>
  scriptStaleness(brief) !== null;

export const scriptText = (script: EventCmScript): string =>
  script.scenes.map((scene) => scene.text).join("");

export const scriptChars = (script: EventCmScript): number =>
  scriptText(script).replace(/\s/g, "").length;
