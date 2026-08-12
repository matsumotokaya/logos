import {
  EVENT_CM_CHARS_PER_SECOND,
  EVENT_CM_SCENE_BUDGET,
  EVENT_CM_SCENE_ROLES,
  sceneChars,
  type EventCmBrief,
  type EventCmSceneRole,
} from "./types";

// How long each scene runs.
//
// The film exists before the narration does, and before the voice does. So the
// timeline is derived from whatever is known, and each stage sharpens it:
//
//   nothing written  → the scene budget (lib: EVENT_CM_SCENE_BUDGET)
//   script written   → the characters actually written, at reading pace
//   voice recorded   → the measured track, which is the truth
//
// This is why a seeded take can be handed over as a finished film with no LLM
// call and no render: "add a video" produces something that plays. Writing the
// narration changes the timing; speaking it changes it again. Nothing along
// the way is a placeholder frame or a spinner.

export interface SceneTiming {
  role: EventCmSceneRole;
  fromMs: number;
  durationMs: number;
}

export type TimingSource = "budget" | "script" | "voice";

export interface EventCmTimeline {
  scenes: SceneTiming[];
  totalMs: number;
  /** What the durations came from — the screen says which, honestly. */
  source: TimingSource;
  /** When the narration starts. Music runs alone before it. */
  narrationStartMs: number;
  /** When the narration ends, so the music can come back up under the close. */
  narrationEndMs: number;
}

const budgetMs = (role: EventCmSceneRole): number => {
  const budget = EVENT_CM_SCENE_BUDGET[role];
  const chars = (budget.min + budget.max) / 2;
  return Math.round((chars / EVENT_CM_CHARS_PER_SECOND) * 1000);
};

/** A beat needs long enough to be read even when its line is short. */
const MIN_SCENE_MS = 2500;

/**
 * Music alone before anyone speaks.
 *
 * A film that starts talking on frame one has no opening. The lead-in is what
 * lets the BGM establish the tone and then step back — which is also the only
 * moment in the film where the music is at full level.
 */
export const EVENT_CM_INTRO_MS = 1400;

export function eventCmTimeline(brief: EventCmBrief): EventCmTimeline {
  const intro = EVENT_CM_INTRO_MS;
  const voiceScenes = brief.voice?.track.scenes;

  if (voiceScenes && voiceScenes.length === EVENT_CM_SCENE_ROLES.length) {
    // Measured timing, pushed back by the lead-in so the music opens alone.
    const scenes = EVENT_CM_SCENE_ROLES.map((role, i) => ({
      role,
      fromMs: voiceScenes[i].startMs + (i === 0 ? 0 : intro),
      durationMs: voiceScenes[i].durationMs + (i === 0 ? intro : 0),
    }));
    const voiceTotal =
      brief.voice?.track.totalMs ??
      voiceScenes.reduce((total, scene) => total + scene.durationMs, 0);
    return {
      scenes,
      totalMs: voiceTotal + intro,
      source: "voice",
      narrationStartMs: intro,
      narrationEndMs: intro + voiceTotal,
    };
  }

  const written = brief.script.scenes.length === EVENT_CM_SCENE_ROLES.length;
  let fromMs = 0;
  const scenes = EVENT_CM_SCENE_ROLES.map((role, i) => {
    const spoken = written
      ? Math.max(
          MIN_SCENE_MS,
          Math.round((sceneChars(brief.script.scenes[i]) / EVENT_CM_CHARS_PER_SECOND) * 1000),
        )
      : budgetMs(role);
    // The lead-in rides on the opening scene, so the film's first picture is
    // already up while the music plays alone.
    const durationMs = i === 0 ? spoken + intro : spoken;
    const timing = { role, fromMs, durationMs };
    fromMs += durationMs;
    return timing;
  });

  return {
    scenes,
    totalMs: fromMs,
    source: written ? "script" : "budget",
    narrationStartMs: intro,
    narrationEndMs: fromMs,
  };
}

export const msToFrames = (ms: number, fps: number): number =>
  Math.max(1, Math.round((ms / 1000) * fps));
