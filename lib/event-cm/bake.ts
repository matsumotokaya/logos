// What the player is showing, and what the workbench holds that it is not.
//
// The storyboard edits `brief`. The player, the MP4 renderer and the public URL
// read `baked_brief` — the copy a run fixed (migration 0050,
// docs/event-cm-refactor-plan.md §9.5). So the two disagree by design, and the
// screen's job is to say by how much rather than to hide it.
//
// This module is the only place that answers "how much". Three surfaces read
// the same answer — the pipeline's badge, the one button's count, and the
// notice over the player (§9.7) — because a badge saying 2 over a notice saying
// nothing is how the last round of bugs started.
//
// Deliberately NOT a deep equality of the two briefs. A brief carries signed
// material URLs that are re-minted on every load, so `brief !== baked_brief` is
// true even when nothing happened. The comparison is on the three things a run
// actually advances: the facts, the scenario, and the recording.

import { isSuppressed } from "./facts";
import {
  eventCmSceneKey,
  scriptStaleness,
  type EventCmBrief,
} from "@/remotion/event-cm/types";

/** One thing the workbench holds that the played film does not. */
export type BakeChange = "facts" | "scenario" | "voice";

/** Said in the user's words, in the order a change travels the pipeline. */
export const BAKE_CHANGE_LABEL: Record<BakeChange, string> = {
  facts: "項目の変更",
  scenario: "シナリオの変更",
  voice: "読み上げの変更",
};

export interface BakeState {
  /**
   * Whether this video has ever been run.
   *
   * `false` is the ordinary opening state, not an error: a take plays from its
   * own seeded brief the moment it is created, which is the product's whole
   * first impression. The screen answers it with guidance (§9.9).
   */
  baked: boolean;
  /** Empty when the player is showing everything the workbench has. */
  changes: BakeChange[];
}

/**
 * The step the one button still has to take.
 *
 * `bake` is the fixing itself: copying the working brief over the played one.
 * It is last because the two before it change what would be copied.
 */
export type FilmStep = "script" | "voice" | "bake";

export const FILM_STEP_LABEL: Record<FilmStep, string> = {
  script: "シナリオを書く",
  voice: "読み上げる",
  bake: "動画に反映する",
};

/**
 * Whether the recording says what the scenario now says.
 *
 * Compared text by text against the scene it was read for, rather than by
 * timestamp: a scenario that was rewritten to the same words is the same
 * narration, and a take whose clock moved is not a reason to spend a TTS call.
 *
 * A recording is what fixes the film's length (§9.9), so this is also the
 * question "does the player know how long this film is".
 */
export function voiceReadsScenario(brief: EventCmBrief): boolean {
  const track = brief.voice?.track;
  if (!track) return false;
  const lines = brief.script?.scenes ?? [];
  if (track.scenes.length !== lines.length) return false;
  const spoken = new Map(
    track.scenes.map((scene) => [eventCmSceneKey(scene), scene.text] as const),
  );
  return lines.every((line) => spoken.get(eventCmSceneKey(line)) === line.text);
}

/**
 * Whether the user switched the narration off.
 *
 * Recorded as an ordinary suppression, so "I do not want a voice" is stored the
 * same way as "I do not want the venue on screen" — a decision, not an empty
 * field. Without it the two decided rules collide: the one button must always
 * reach a recording (§9.9), and a narration that was turned off must stay off
 * (§9.3). The first would silently undo the second on the next run.
 */
export const narrationIsOff = (brief: EventCmBrief): boolean =>
  isSuppressed(brief, "voice");

/**
 * How far the played film is behind the workbench.
 *
 * `baked` null = never run. Everything else is a three-way comparison of the
 * nodes the pipeline advances (§9.7).
 */
export function bakeState(
  working: EventCmBrief,
  baked: EventCmBrief | null,
): BakeState {
  if (!baked) return { baked: false, changes: [] };

  const changes: BakeChange[] = [];
  if ((working.factsUpdatedAt ?? "") !== (baked.factsUpdatedAt ?? "")) {
    changes.push("facts");
  }
  if ((working.script?.updatedAt ?? "") !== (baked.script?.updatedAt ?? "")) {
    changes.push("scenario");
  }
  // The recording's own stamp, never `voice.audio`: the pointer is rewritten as
  // a freshly signed URL on every load, so comparing it would report a change
  // on a page refresh.
  if (
    (working.voice?.track.generatedAt ?? "") !==
    (baked.voice?.track.generatedAt ?? "")
  ) {
    changes.push("voice");
  }
  return { baked: true, changes };
}

/**
 * What the one button will do to this video, in order.
 *
 * The count of these is the badge. It is a forward projection, not a status
 * scan: writing the scenario makes the recording stale, and a recording makes
 * the fixed copy stale, so a step that WILL become necessary is listed now.
 * A badge that says 1 and then runs three steps is worse than no badge.
 *
 * Two things are never listed:
 *   - a hand-written scenario. It is not overwritten, and counting a change
 *     nobody will make is what makes a badge unclearable (§9.8).
 *   - a narration the user switched off. See `narrationIsOff`.
 *
 * MP4 is not here at all. Export is outside the chain (§9.4) — putting it in
 * would run a several-minute render every time somebody tried a voice.
 */
export function pendingFilmSteps(
  working: EventCmBrief,
  baked: EventCmBrief | null,
  options: {
    /**
     * Ask for everything again, because the user pressed the button with
     * nothing pending. Every step here is a model call, and a draft that came
     * out slightly wrong is an ordinary reason to ask again — the same reason
     * the reading stages stay pressable when their badge is empty.
     *
     * It does not override the two refusals: hand-written words and a narration
     * switched off are decisions, not stale state.
     */
    redo?: boolean;
  } = {},
): FilmStep[] {
  const steps: FilmStep[] = [];

  const handWritten = working.script?.source === "human";
  const unwritten = (working.script?.scenes.length ?? 0) === 0;
  const scriptPending =
    !handWritten && (options.redo || unwritten || scriptStaleness(working) !== null);
  if (scriptPending) steps.push("script");

  // Always reached unless it was switched off or there is nothing to read: the
  // length of the film is not known until something has been spoken, so "no
  // recording" is pending work rather than a finished state.
  //
  // `scriptPending` counts as words-to-come, which is what keeps the badge a
  // projection: writing the scenario is what makes the recording necessary. But
  // a scenario nobody is going to write — hand-authored and still empty — has
  // nothing to read, and listing it would promise a step that answers 409.
  const voicePending =
    !narrationIsOff(working) &&
    (scriptPending ||
      (!unwritten &&
        (options.redo || !working.voice || !voiceReadsScenario(working))));
  if (voicePending) steps.push("voice");

  const state = bakeState(working, baked);
  if (
    options.redo ||
    !state.baked ||
    state.changes.length > 0 ||
    scriptPending ||
    voicePending
  ) {
    steps.push("bake");
  }
  return steps;
}

/**
 * Whether the exported MP4 is older than the film the player shows.
 *
 * Both timestamps or nothing: a video with no export has no stale export, and
 * one that has never been run has nothing to be older than.
 */
export const renderIsBehind = (
  renderedAt: string | null,
  bakedAt: string | null,
): boolean =>
  Boolean(renderedAt && bakedAt && new Date(renderedAt) < new Date(bakedAt));
