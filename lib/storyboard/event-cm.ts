// The storyboard: what each picture of the film holds, before it is a picture.
//
// Not a preview. The film has a moving ink ground, gold particles and type that
// animates — none of that can be reproduced honestly at a sixth of the size, and
// trying would make a worse promise than showing nothing. What a storyboard is
// FOR is deciding the scenario and the composition: which beat says what, what
// is on screen while it says it, and what is missing.
//
// Everything here is a RE-SAYING of `eventCmFilm()` — the same derivation the
// renderer sequences (remotion/event-cm/film.ts). This module derives nothing
// about the film itself; it only adds the human layer: labels, provenance
// badges, and which fields the enlarged panel can correct. That is what makes
// "the storyboard describes a film nobody is making" structurally impossible
// rather than merely tested against.
//
// One panel per scene, one scene per narration line. The two silent scenes —
// the presenter's mark, opening and closing — are panels too: they are what the
// film shows, and a storyboard that skipped them would not add up to the film.

import {
  EMPTY_BEHAVIOUR,
  isEmpty,
  textOf,
  type ComponentKind,
  type Emphasis,
  type SceneComponent,
} from "@/remotion/kit/components";
import type { LayoutSlot, SceneLayout } from "@/remotion/kit/layout";
import type { Theme } from "@/remotion/kit/theme";
import type { Caption } from "@/remotion/event-cm/captions";
import { eventCmFilm } from "@/remotion/event-cm/film";
import type { TimingSource } from "@/remotion/event-cm/timeline";
import type { EventCmBrief, EventCmSceneRole } from "@/remotion/event-cm/types";
import type { LogoTreatment } from "@/remotion/event/types";
import { EVENT_CM_GOAL, eventCmGoalState } from "@/lib/pipeline/event-cm";
import { FACT_FIELDS, isPhotoSlot, isSuppressed } from "@/lib/event-cm/facts";
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
  /** 1-based, in film order. A LABEL — never an identity (React keys and API
   *  calls use the scene key; a deleted panel renumbers everything after it). */
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
  /** The theme the film is drawn under — the same object the renderer paints
   *  with, so the panels and the film measure against one type scale. */
  theme: Theme;
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
 * The storyboard for one brief: `eventCmFilm()`, said in human words.
 *
 * Panel boundaries, sizes, drops, subtitles and narration all come from the
 * film object itself. What this adds is labels, provenance and editability —
 * the link back to the brief that turns the enlarged panel into the place you
 * correct things.
 */
export function eventCmStoryboard(raw: EventCmBrief): Storyboard {
  const film = eventCmFilm(raw);
  // The film's own view of the brief (suppressed fields emptied), so a block's
  // words and figures match what the renderer will set. Provenance survives
  // suppression, so origin badges still read correctly from this copy.
  const brief = film.drawn;
  const goal = eventCmGoalState(brief);
  const origins = new Map<string, FieldOrigin | null>(
    goal.fields.map((field) => [field.path, field.origin]),
  );

  const panels: StoryboardPanel[] = film.scenes.map((scene, at) => {
    const regions: StoryboardRegion[] = scene.regions.map((region) => ({
      region: region.region,
      blocks: region.blocks.map(({ component, emphasis }) =>
        blockOf(component, brief, origins, emphasis),
      ),
    }));
    const blocks = regions.flatMap((region) => region.blocks);

    return {
      no: at + 1,
      role: scene.role,
      ...(scene.index === undefined ? {} : { index: scene.index }),
      narrated: scene.narrated,
      fromMs: scene.fromMs,
      durationMs: scene.durationMs,
      layout: scene.scene.layout,
      capacity: scene.capacity,
      regions,
      backdrop: scene.scene.backdrop
        ? {
            src: scene.scene.backdrop.photo.src,
            weight: scene.scene.backdrop.weight,
            focus: scene.scene.backdrop.photo.focus ?? { x: 0.5, y: 0.5 },
            fields: (scene.scene.backdrop.fields ?? []).map((path) =>
              fieldOf(brief, path, origins),
            ),
          }
        : null,
      dropped: scene.dropped.map((component) => component.kind),
      captions: scene.captions,
      narration: scene.narration,
      counts: countBlocks(blocks),
    };
  });

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
    theme: film.theme,
    orphanLines: film.orphanLines.map((line) => ({
      role: line.role,
      ...(line.index === undefined ? {} : { index: line.index }),
      text: line.text,
    })),
    totalMs: film.totalMs,
    timingSource: film.timingSource,
    counts,
  };
}
