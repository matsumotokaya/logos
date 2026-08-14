// The film, derived once.
//
// "What film does this brief make?" used to be answered by hand in several
// places — the composition, the storyboard, the scenario API, the voice API —
// each walking its own subset of the same six steps (suppression → plan →
// timeline → scenes → fit → captions). Every bug in the 2026-08-14 session had
// the same shape: one consumer skipped a step the others took, and the film
// and its description disagreed (docs/event-cm-refactor-plan.md §1–2).
//
// This module is the answer said once. The composition sequences
// `film.scenes`; the storyboard re-says them in human words; the scenario and
// voice APIs read `film.scenes.filter((scene) => scene.narrated)`. None of
// them derive anything about the film themselves.
//
// Deliberately not a React module: the same function runs in the Player, the
// CLI renderer, API routes and tests.

import {
  emphasisOf,
  type Emphasis,
  type SceneComponent,
} from "@/remotion/kit/components";
import { fitScene, type SceneFit } from "@/remotion/kit/fit";
import {
  distribute,
  LAYOUTS,
  overCapacity,
  type LayoutSlot,
  type Scene,
} from "@/remotion/kit/layout";
import { sceneForRole } from "@/remotion/kit/scenes/event-cm";
import { SUMI_THEME, themeForBrand, type Theme } from "@/remotion/kit/theme";
import { suppressedPaths } from "@/lib/event-cm/facts";
import { captionsFor, type Caption } from "./captions";
import { eventCmTimeline, type TimingSource } from "./timeline";
import {
  eventCmNarratedSteps,
  eventCmSceneBudget,
  eventCmSceneKey,
  scenarioStaleness,
  type EventCmBrief,
  type EventCmScene,
  type EventCmSceneRole,
  type EventCmScenario,
  type ScenarioStaleness,
} from "./types";

/** One region of one picture, with its blocks at the emphasis the fitter
 *  settled on — not the one the scene asked for. */
export interface FilmRegion {
  region: LayoutSlot["region"];
  blocks: Array<{ component: SceneComponent; emphasis: Emphasis }>;
}

/** One picture of the film. */
export interface FilmScene {
  /** The picture's identity (eventCmSceneKey). The one legal React key. */
  key: string;
  role: EventCmSceneRole;
  /** Which item, when the role repeats (programmes). */
  index?: number;
  /** Whether anything is said over this picture. Decided by the film's shape,
   *  never by whether its line has been written yet. */
  narrated: boolean;
  fromMs: number;
  durationMs: number;
  /** The kit scene as built — layout, components, backdrop. What the Stage
   *  draws. The Stage runs the same fitter itself at draw time, so `placed`
   *  below is a description of what it will do, not a separate decision. */
  scene: Scene;
  /** Components that will be drawn, with the emphasis they ended up at. */
  placed: SceneFit["placed"];
  /** Components the film leaves out: the fitter's drops first (those the
   *  renderer obeys), then the arrangement's advisory capacity overflow. */
  dropped: SceneComponent[];
  /** How many components the arrangement was designed for. Advisory. */
  capacity: number;
  /** The picture's blocks, region by region, in draw order. */
  regions: FilmRegion[];
  /** The line's character budget. Null for the silent mark scenes. */
  budget: { min: number; max: number } | null;
  /** The line read over this picture. Empty when silent or not yet written. */
  scenario: string;
  /** The subtitles on screen while this picture is. Bounded by the scene. */
  captions: Caption[];
}

export interface EventCmFilm {
  /**
   * The brief AS THE FILM DRAWS IT — suppression applied, values emptied.
   *
   * Named `drawn` so that saving it reads as the mistake it is: a suppressed
   * field's value only survives in the stored brief, and writing this copy
   * back would turn "taken off screen" into "deleted".
   */
  drawn: EventCmBrief;
  theme: Theme;
  scenes: FilmScene[];
  /** The whole film's subtitles, for the caption band. */
  captions: Caption[];
  totalMs: number;
  /** Whether durations come from the budget, the scenario, or the measured
   *  voice. The screen says which rather than implying precision. */
  timingSource: TimingSource;
  /** When the narration starts and ends. Music runs alone outside them. */
  narrationStartMs: number;
  narrationEndMs: number;
  /** Scenario lines the current film has no picture for. Not deleted — said. */
  orphanLines: EventCmScene[];
  /** Pictures that speak but have no line yet (keys). A normal state while
   *  somebody is writing; only reading aloud requires all of them. */
  missingLines: string[];
  /** Why the narration and the film disagree, when they do. */
  staleness: ScenarioStaleness;
  hasVoice: boolean;
}

/** The theme this brief renders under: the reference art direction, wearing
 *  whatever the brand actually has. */
const themeOf = (brief: EventCmBrief): Theme =>
  brief.theme ? themeForBrand(SUMI_THEME, brief.theme) : SUMI_THEME;

/**
 * The brief as it should be drawn: suppressed fields emptied out.
 *
 * Emptying rather than flagging, because every component already knows what to
 * do with nothing — omit, or draw its designed substitute (components.ts
 * EMPTY_BEHAVIOUR). Teaching the renderer a second kind of absence would mean
 * touching seventeen components to express a decision the brief can express
 * on its own.
 *
 * Private on purpose. When this was public, calling it before deriving
 * anything was the caller's responsibility, and every consumer that forgot
 * described a film nobody was making. Now the only door to a drawn brief is
 * `eventCmFilm(brief).drawn`.
 */
function applySuppression(brief: EventCmBrief): EventCmBrief {
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
    // A portrait can be taken off on its own: the speaker is still announced,
    // the photograph is replaced by the monogram the component draws when it
    // has none. Removing the person instead would be a different decision.
    guests: off("guests")
      ? []
      : brief.guests.map((guest, index) =>
          off(`guests[${index}].photo`) ? { ...guest, photo: null } : guest,
        ),
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
      value: off("visuals.value") ? null : brief.visuals.value,
      programs: off("visuals.programs") ? null : brief.visuals.programs,
      closing: off("visuals.closing") ? null : brief.visuals.closing,
    },
  };
}

/**
 * Derive the film — the ONLY place the six steps run in order.
 *
 * Pure and deterministic: the same brief always returns the same film, so
 * running it in the Player, the renderer and an API route cannot disagree.
 */
const EMPTY_SCENARIO: EventCmScenario = {
  version: 1,
  scenes: [],
  source: "llm",
  updatedAt: "",
  angle: "",
};

export function eventCmFilm(raw: EventCmBrief): EventCmFilm {
  // Total over degenerate input. The type requires `scenario`, but a brief that
  // reached the database without one must derive the same film as "not written
  // yet" (an empty scene list — the schema's own legal state) rather than
  // throwing halfway into whichever API handler asked. The one derivation is
  // only the one derivation if it always answers.
  const stored = raw.scenario ? raw : { ...raw, scenario: EMPTY_SCENARIO };
  // A field the user switched off is emptied before anything is built, so the
  // components' existing empty behaviour carries the decision.
  const drawn = applySuppression(stored);
  const theme = themeOf(drawn);
  const timeline = eventCmTimeline(drawn);
  const captions = captionsFor(drawn);

  // By scene identity, never by role: three programme pictures share a role,
  // and only their index tells them apart.
  const scenarioOf = new Map(
    drawn.scenario.scenes.map((scene) => [eventCmSceneKey(scene), scene.text] as const),
  );
  const narratedKeys = new Set(eventCmNarratedSteps(drawn).map(eventCmSceneKey));

  const scenes: FilmScene[] = timeline.scenes.map((beat) => {
    const key = eventCmSceneKey(beat);
    const scene = sceneForRole(beat.role, drawn, beat.index);
    const spec = LAYOUTS[scene.layout];

    // The same fit the Stage runs at draw time, on the same theme. `placed`
    // may hold copies (a second `hero` is demoted), so the regions are built
    // from what the fitter returns and consumers draw those same objects.
    const fit = fitScene(scene.components, theme);
    const emphasisFor = new Map<SceneComponent, Emphasis>(
      fit.placed.map((item) => [item.component, item.emphasis]),
    );
    const kept: Scene = { ...scene, components: fit.placed.map((item) => item.component) };
    const regions: FilmRegion[] = distribute(kept).map((group, slotIndex) => ({
      region: spec.slots[slotIndex].region,
      blocks: group.map((component) => ({
        component,
        emphasis: emphasisFor.get(component) ?? emphasisOf(component),
      })),
    }));

    const narrated = narratedKeys.has(key);
    const fromMs = beat.fromMs;
    const durationMs = beat.durationMs;

    return {
      key,
      role: beat.role,
      ...(beat.index === undefined ? {} : { index: beat.index }),
      narrated,
      fromMs,
      durationMs,
      scene,
      placed: fit.placed,
      // The fitter's decision comes first because that is the one the renderer
      // obeys; the arrangement's capacity is advisory (the stage draws past
      // it) and comes after.
      dropped: [...fit.dropped, ...overCapacity(kept)],
      capacity: spec.capacity,
      regions,
      budget: narrated ? eventCmSceneBudget(beat) : null,
      scenario: scenarioOf.get(key) ?? "",
      captions: captions.filter(
        (caption) => caption.fromMs < fromMs + durationMs && caption.toMs > fromMs,
      ),
    };
  });

  return {
    drawn,
    theme,
    scenes,
    captions,
    totalMs: timeline.totalMs,
    timingSource: timeline.source,
    narrationStartMs: timeline.narrationStartMs,
    narrationEndMs: timeline.narrationEndMs,
    orphanLines: drawn.scenario.scenes.filter(
      (scene) => !narratedKeys.has(eventCmSceneKey(scene)),
    ),
    missingLines: scenes
      .filter((scene) => scene.narrated && scene.scenario.trim().length === 0)
      .map((scene) => scene.key),
    staleness: scenarioStaleness(drawn),
    hasVoice: Boolean(drawn.voice),
  };
}
