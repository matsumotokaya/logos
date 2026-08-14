// The storyboard: what each picture of the film holds, before it is a picture.
//
// Not a preview. The film has a moving ink ground, gold particles and type that
// animates — none of that can be reproduced honestly at a sixth of the size, and
// trying would make a worse promise than showing nothing. What a storyboard is
// FOR is deciding the scenario and the composition: which beat says what, what
// is on screen while it says it, and what is missing.
//
// Everything here is derived from what the renderer itself consumes — the same
// `sceneForRole`, the same `distribute`, the same timeline and captions — so
// the storyboard cannot describe a film that is no longer being made. The one
// thing it adds is the link back to the brief (`fields` on each component), and
// that is what turns the enlarged panel into the place you correct things.
//
// One panel per scene, one scene per narration line. The two silent scenes —
// the presenter's mark, opening and closing — are panels too: they are what the
// film shows, and a storyboard that skipped them would not add up to the film.

import {
  EMPTY_BEHAVIOUR,
  emphasisOf,
  isEmpty,
  textOf,
  type ComponentKind,
  type Emphasis,
  type SceneComponent,
} from "@/remotion/kit/components";
import { distribute, LAYOUTS, overCapacity, type LayoutSlot, type SceneLayout } from "@/remotion/kit/layout";
import { fitScene } from "@/remotion/kit/fit";
import { SUMI_THEME, themeForBrand, type Theme } from "@/remotion/kit/theme";
import { sceneForRole } from "@/remotion/kit/scenes/event-cm";
import { captionsFor, type Caption } from "@/remotion/event-cm/captions";
import { eventCmTimeline, type TimingSource } from "@/remotion/event-cm/timeline";
import {
  eventCmNarratedSteps,
  eventCmSceneKey,
  type EventCmBrief,
  type EventCmSceneRole,
} from "@/remotion/event-cm/types";
import type { LogoTreatment } from "@/remotion/event/types";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import {
  applySuppression,
  FACT_FIELDS,
  isPhotoSlot,
  isSuppressed,
} from "@/lib/event-cm/facts";
import { EVENT_CM_GOAL } from "@/lib/pipeline/event-cm";
import type { FieldOrigin } from "@/lib/pipeline/stages";

/** What each component kind is called on the storyboard. The vocabulary is
 *  English in code (it is a contract); on screen it has to be readable. */
export const BLOCK_LABELS: Record<ComponentKind, string> = {
  kicker: "小見出し",
  heading: "見出し",
  subheading: "副見出し",
  lines: "コピー",
  body: "説明",
  chip: "ラベル",
  list: "箇条",
  person: "人物",
  people: "人物（複数）",
  logo: "ロゴ",
  logoRow: "ロゴ列",
  stat: "数値",
  datetime: "日時",
  cta: "行動喚起",
  image: "写真",
  rule: "罫線",
  mark: "記号",
};

/** The four ways a component can arrive on screen. */
export type BlockState =
  /** It has a value and will be set as itself. */
  | "filled"
  /** It has nothing, and the designed stand-in takes its place. */
  | "substitute"
  /** It has nothing and leaves; the layout closes up. */
  | "omitted";

export interface StoryboardField {
  path: string;
  label: string;
  /** Where the value came from. Null when the field holds nothing. */
  origin: FieldOrigin | null;
  /** Whether this field can be corrected from the panel (FactEdit). Headings
   *  like `programsHeading` are not in the goal, so they cannot — and saying so
   *  is more useful than a button that does nothing. */
  editable: boolean;
  /** The user switched this field off; the component behaves as empty. */
  suppressed: boolean;
}

/**
 * One thing inside a figure block — a speaker, a partner logo, a photograph.
 *
 * Needed because a `people` block with three speakers and one missing portrait
 * is neither filled nor empty: it will be set with two photographs and one
 * monogram, and that is exactly what somebody reading a storyboard wants to
 * know. `textOf` cannot answer it (it deliberately returns only the names that
 * will be *typeset*, which for logos is the ones with no image).
 */
export interface StoryboardFigure {
  label: string;
  /** Whether the image exists. False = the component's designed stand-in. */
  hasAsset: boolean;
  /**
   * The image itself, when the brief holds one.
   *
   * Drawn rather than described. A framed box with the name typeset inside is
   * not a neutral placeholder — it is a composition, and readers took it for
   * the design the film would use. Worse, it was drawn in the accent colour,
   * so an invented frame wore the one colour this art direction reserves for
   * real decisions. Where there is a picture, the panel shows the picture.
   */
  src: string | null;
  /** How the film treats a mark on the ink ground (knocked out, inverted). */
  treatment?: LogoTreatment;
  focus?: { x: number; y: number };
  zoom?: number;
}

export interface StoryboardBlock {
  kind: ComponentKind;
  label: string;
  emphasis: Emphasis;
  /** The words this block sets. Empty for figures and decoration. */
  text: string[];
  /** People, logos and photographs, in draw order. Empty for type blocks. */
  figures: StoryboardFigure[];
  state: BlockState;
  /** Only when `substitute`: the designed stand-in, in words. */
  substitute: string | null;
  fields: StoryboardField[];
}

export interface StoryboardRegion {
  region: LayoutSlot["region"];
  blocks: StoryboardBlock[];
}

/**
 * The photograph this picture stands on.
 *
 * Drawn, not described. The storyboard promises nothing about the ink drift,
 * the particles or the way type arrives — none of that survives being a sixth
 * of the size. But *which photograph is behind this scene* is exactly the kind
 * of thing a storyboard is read to find out, and a panel that showed the same
 * empty ground whether or not a picture had been placed would answer the
 * question wrongly rather than leaving it open.
 */
export interface StoryboardBackdrop {
  src: string;
  weight: "hero" | "support";
  focus: { x: number; y: number };
  fields: StoryboardField[];
}

export interface StoryboardPanel {
  /** 1-based, in film order. */
  no: number;
  role: EventCmSceneRole;
  /** Which item this picture is about, when the role repeats (programmes). */
  index?: number;
  /** Whether anything is said over this picture. The mark scenes are silent. */
  narrated: boolean;
  fromMs: number;
  durationMs: number;
  layout: SceneLayout;
  capacity: number;
  regions: StoryboardRegion[];
  /** The ground, when this scene has a photograph under it. */
  backdrop: StoryboardBackdrop | null;
  /** Components past the arrangement's capacity: they will be dropped, not
   *  shrunk (remotion/kit/fit.ts). */
  dropped: ComponentKind[];
  /** The subtitles on screen while this panel is. */
  captions: Caption[];
  /** The line read over this picture. Empty for the silent mark scenes. */
  narration: string;
  counts: PanelCounts;
}

export interface PanelCounts {
  blocks: number;
  filled: number;
  substitute: number;
  omitted: number;
  /** Fields on this panel the tool guessed (`inferred`). */
  provisional: number;
}

/**
 * A line of narration with no picture to be read over.
 *
 * Happens when the film's shape changes under a script: three programmes
 * replace one programme picture, or a field is switched off. The words are not
 * deleted — they are still in the brief — and saying so is the difference
 * between "your text is gone" and "your text no longer has a place".
 */
export interface StoryboardOrphanLine {
  role: EventCmSceneRole;
  index?: number;
  text: string;
}

export interface Storyboard {
  panels: StoryboardPanel[];
  /** Script lines the current film has no picture for. */
  orphanLines: StoryboardOrphanLine[];
  totalMs: number;
  /** Whether the durations come from the scene budget, the script, or the
   *  measured voice. The storyboard says which rather than implying precision. */
  timingSource: TimingSource;
  counts: PanelCounts;
}

const GOAL_LABELS = new Map(EVENT_CM_GOAL.map((field) => [field.path, field.label]));
const EDITABLE_PATHS = new Set(FACT_FIELDS.map((field) => field.path));

/** A field with no row in the goal still needs a name on screen. */
const FALLBACK_LABELS: Record<string, string> = {
  programsHeading: "プログラムの見出し",
  guestsHeading: "登壇者の見出し",
  footnote: "注記",
  "schedule.weekday": "曜日",
};

const GUEST_PHOTO = /^guests\[(\d+)\]\.photo$/;

function fieldOf(
  brief: EventCmBrief,
  path: string,
  origins: Map<string, FieldOrigin | null>,
): StoryboardField {
  const guest = GUEST_PHOTO.exec(path);
  return {
    path,
    label: guest
      ? `${brief.guests[Number(guest[1])]?.name ?? ""}の写真`
      : (GOAL_LABELS.get(path) ?? FALLBACK_LABELS[path] ?? path),
    origin: origins.get(path) ?? null,
    // A photograph is corrected by choosing another one rather than by typing,
    // but it is corrected from the same panel — which is what `editable` is
    // asking. The list decides what kind of control to draw (FactList).
    editable: EDITABLE_PATHS.has(path) || isPhotoSlot(path),
    suppressed: isSuppressed(brief, path),
  };
}

const personFigure = (person: {
  name: string;
  photo: { src: string; focus?: { x: number; y: number }; zoom?: number } | null;
}): StoryboardFigure => ({
  label: person.name,
  hasAsset: person.photo !== null,
  src: person.photo?.src ?? null,
  focus: person.photo?.focus,
  zoom: person.photo?.zoom,
});

const logoFigure = (logo: {
  name: string;
  src: string | null;
  treatment?: LogoTreatment;
}): StoryboardFigure => ({
  label: logo.name,
  hasAsset: Boolean(logo.src),
  src: logo.src,
  // The same default the renderer uses: on an ink ground a mark is knocked out
  // unless the brief says otherwise (remotion/kit/render/KitComponent.tsx).
  treatment: logo.treatment ?? "knockout",
});

function figuresOf(component: SceneComponent): StoryboardFigure[] {
  switch (component.kind) {
    case "person":
      return [personFigure(component.person)];
    case "people":
      return component.people.map(personFigure);
    case "logo":
      return [logoFigure({ name: component.name, src: component.src, treatment: component.treatment })];
    case "logoRow":
      return component.logos.map(logoFigure);
    case "image":
      return [
        {
          label: "写真",
          hasAsset: component.photo !== null,
          src: component.photo?.src ?? null,
          focus: component.photo?.focus,
        },
      ];
    default:
      return [];
  }
}

function blockOf(
  component: SceneComponent,
  brief: EventCmBrief,
  origins: Map<string, FieldOrigin | null>,
  /** The emphasis the fitter settled on — not the one the scene asked for. */
  emphasis: Emphasis,
): StoryboardBlock {
  const empty = isEmpty(component);
  const behaviour = EMPTY_BEHAVIOUR[component.kind];
  const state: BlockState = !empty
    ? "filled"
    : behaviour.mode === "substitute"
      ? "substitute"
      : "omitted";
  return {
    kind: component.kind,
    label: BLOCK_LABELS[component.kind],
    emphasis,
    text: textOf(component).filter((line) => line.trim().length > 0),
    figures: figuresOf(component),
    state,
    substitute: state === "substitute" && behaviour.mode === "substitute" ? behaviour.note : null,
    fields: (component.fields ?? []).map((path) => fieldOf(brief, path, origins)),
  };
}

const emptyCounts = (): PanelCounts => ({
  blocks: 0,
  filled: 0,
  substitute: 0,
  omitted: 0,
  provisional: 0,
});

function countBlocks(blocks: StoryboardBlock[]): PanelCounts {
  const counts = emptyCounts();
  const seenPaths = new Set<string>();
  for (const block of blocks) {
    // Decoration is not a slot anybody fills, so counting it would make every
    // panel look more complete than it is.
    if (block.kind === "rule" || block.kind === "mark") continue;
    counts.blocks += 1;
    counts[block.state] += 1;
    for (const field of block.fields) {
      if (field.origin === "inferred" && !seenPaths.has(field.path)) {
        seenPaths.add(field.path);
        counts.provisional += 1;
      }
    }
  }
  return counts;
}

/**
 * The storyboard for one brief.
 *
 * Panel boundaries are the timeline's own, which is what the composition
 * sequences from — so a panel's stated span is the film's actual cut.
 */
/** The theme this brief is drawn under. The same one the composition builds
 *  (EventCmComposition.themeOf) — exported so the panel and the model cannot
 *  end up measuring against different type scales. */
export const storyboardTheme = (brief: EventCmBrief): Theme =>
  brief.theme ? themeForBrand(SUMI_THEME, brief.theme) : SUMI_THEME;

export function eventCmStoryboard(raw: EventCmBrief): Storyboard {
  // Everything below is built from the brief AS THE FILM SEES IT.
  //
  // Two things used to be read differently here than in the composition, and
  // both made the storyboard describe a film nobody was making:
  //
  //   1. Suppression. The composition empties switched-off fields before
  //      building anything; the storyboard read the raw brief, so a field the
  //      user took off screen still had a block — and if `guests` was the field,
  //      the storyboard had a whole panel and a whole scene's worth of seconds
  //      that the film does not contain.
  //   2. The fitter. The stage sets each component as loudly as it can and
  //      DROPS what cannot be set even two steps down (remotion/kit/fit.ts).
  //      The storyboard drew every component at the size the scene asked for,
  //      so a long programme list appeared large and complete in the panel and
  //      came out smaller — or absent — in the film.
  const brief = applySuppression(raw);
  const theme = storyboardTheme(brief);
  const timeline = eventCmTimeline(brief);
  const captions = captionsFor(brief);
  const goal = eventCmGoalState(brief);
  const origins = new Map<string, FieldOrigin | null>(
    goal.fields.map((field) => [field.path, field.origin]),
  );
  // By scene identity: with a picture per programme, three lines share the role
  // `program` and only their index tells them apart.
  const narrationOf = new Map(
    brief.script.scenes.map((scene) => [eventCmSceneKey(scene), scene.text] as const),
  );
  // Whether a picture SPEAKS is a fact about the film, not about whether anybody
  // has written its line yet. Deriving it from the script's contents made the
  // three new programme pictures claim to be silent — no line, no subtitle, and
  // no editor to write one in — because the stored script still held a single
  // unindexed `program` line.
  const narratedKeys = new Set(eventCmNarratedSteps(brief).map(eventCmSceneKey));

  const panels: StoryboardPanel[] = [];

  for (const beat of timeline.scenes) {
    const scene = sceneForRole(beat.role, brief, beat.index);
    const spec = LAYOUTS[scene.layout];
    const fromMs = beat.fromMs;
    const durationMs = beat.durationMs;

    // The same fit the stage runs, on the same theme. `placed` may hold copies
    // of components (a second `hero` is demoted), so the map is keyed by what
    // the fitter returns and the panel draws those same objects.
    const fit = fitScene(scene.components, theme);
    const emphasisFor = new Map<SceneComponent, Emphasis>(
      fit.placed.map((item) => [item.component, item.emphasis]),
    );
    const kept = { ...scene, components: fit.placed.map((item) => item.component) };

    const regions: StoryboardRegion[] = distribute(kept).map((group, slotIndex) => ({
      region: spec.slots[slotIndex].region,
      blocks: group.map((component) =>
        blockOf(component, brief, origins, emphasisFor.get(component) ?? emphasisOf(component)),
      ),
    }));
    const blocks = regions.flatMap((region) => region.blocks);

    panels.push({
      no: panels.length + 1,
      role: beat.role,
      ...(beat.index === undefined ? {} : { index: beat.index }),
      narrated: narratedKeys.has(eventCmSceneKey(beat)),
      fromMs,
      durationMs,
      layout: scene.layout,
      capacity: spec.capacity,
      regions,
      backdrop: scene.backdrop
        ? {
            src: scene.backdrop.photo.src,
            weight: scene.backdrop.weight,
            focus: scene.backdrop.photo.focus ?? { x: 0.5, y: 0.5 },
            fields: (scene.backdrop.fields ?? []).map((path) =>
              fieldOf(brief, path, origins),
            ),
          }
        : null,
      // What the film actually leaves out. The fitter's decision comes first
      // because that is the one the renderer obeys; the arrangement's capacity
      // is advisory (the stage draws past it) and is reported separately.
      dropped: [
        ...fit.dropped.map((component) => component.kind),
        ...overCapacity(kept).map((component) => component.kind),
      ],
      captions: captions.filter(
        (caption) => caption.fromMs < fromMs + durationMs && caption.toMs > fromMs,
      ),
      narration: narrationOf.get(eventCmSceneKey(beat)) ?? "",
      counts: countBlocks(blocks),
    });
  }

  const counts = panels.reduce((total, panel) => {
    total.blocks += panel.counts.blocks;
    total.filled += panel.counts.filled;
    total.substitute += panel.counts.substitute;
    total.omitted += panel.counts.omitted;
    return total;
  }, emptyCounts());
  // Counted across the film rather than summed from the panels: one guessed
  // field can appear on two panels, and it is still one thing to check.
  counts.provisional = goal.provisional.length;

  return {
    panels,
    orphanLines: brief.script.scenes
      .filter((scene) => !narratedKeys.has(eventCmSceneKey(scene)))
      .map((scene) => ({
        role: scene.role,
        ...(scene.index === undefined ? {} : { index: scene.index }),
        text: scene.text,
      })),
    totalMs: timeline.totalMs,
    timingSource: timeline.source,
    counts,
  };
}
