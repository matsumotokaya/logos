import type { Scene, SceneBackdrop } from "../layout";
import type { SceneComponent } from "../components";
import type { EventPhoto } from "@/remotion/event/types";
import { eventCmScenePlan } from "@/remotion/event-cm/types";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import type { EventCmSceneRole } from "@/remotion/event-cm/types";

// The narrated event promo, written in the vocabulary.
//
// This is the acceptance test for the whole rewrite: if 世界が恋する日本酒
// cannot be rebuilt from these seventeen components and seven arrangements,
// the vocabulary is not finished. Everything the hand-composed version did is
// either here or is a gap worth naming.
//
// What each scene gets is a real editorial decision, not a mapping table:
//
//   logoIn   the presenter's mark, knocked out, with the series above it.
//   title    the title. One hero per film, and this is it.
//   value    the promise, as verse, over the主役 photograph.
//   program  what happens, numbered.
//   guests   who speaks. Portraits, or monograms where there is no photograph.
//   cta      the date, the call, the credits. Space is the statement.
//   logoOut  the mark again, alone.
//
// Arrangements alternate deliberately (centre → centre → full-bleed → numbered
// → row → corner) because a film whose every scene is centred reads as a slide
// deck however well each slide is set.

/**
 * A ground, when there is a photograph for it.
 *
 * Written as a spread so that a scene with no photograph carries no `backdrop`
 * key at all, rather than an explicit `undefined` — the same distinction the
 * rest of the brief keeps between "nothing here" and "a value that is empty".
 */
const backdropFor = (
  photo: EventPhoto | null,
  weight: SceneBackdrop["weight"],
  field: string,
): { backdrop?: SceneBackdrop } =>
  photo ? { backdrop: { photo, weight, fields: [field] } } : {};

/**
 * The presenter's mark, alone.
 *
 * Both ends of the film are this scene: it opens so the viewer knows whose film
 * this is before anyone speaks, and closes so they remember. `logos[0]` is the
 * brand's own mark (lib/event-cm/seed.ts puts it there); with no image the
 * `logo` component sets the name as a mincho credit, which is the designed
 * answer rather than a gap.
 *
 * The closing plate drops the series label. By then it has been said, and the
 * last thing on screen should be one thing.
 */
function markScene(brief: EventCmBrief, opening: boolean): Scene {
  const mark = brief.logos[0] ?? null;
  const components: SceneComponent[] = [];
  if (opening && brief.seriesLabel) {
    components.push({ kind: "kicker", text: brief.seriesLabel, fields: ["seriesLabel"] });
  }
  components.push({
    kind: "logo",
    src: mark?.src ?? null,
    name: mark?.name ?? brief.presenter,
    scale: mark?.scale,
    // Knocked out unless the brief says otherwise. The stage is ink black and a
    // brand SVG is usually dark, so drawing the artwork as supplied is how the
    // opening plate came out as a black mark on a black ground.
    treatment: mark?.treatment ?? "knockout",
    emphasis: "hero",
    fields: ["logos"],
  });
  components.push({ kind: "rule", length: "short" });
  if (brief.presenter) {
    components.push({
      kind: "body",
      text: brief.presenter,
      emphasis: "caption",
      fields: ["presenter"],
    });
  }
  return { layout: "centre-stack", components };
}

/** The title screen. The narration's first line calls this title. */
function titleScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [
    { kind: "heading", text: brief.title, fields: ["title"] },
  ];
  if (brief.subtitle) {
    components.push({ kind: "subheading", text: brief.subtitle, fields: ["subtitle"] });
  }
  return { layout: "centre-stack", components };
}

function valueScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [];
  if (brief.valueChip) {
    components.push({ kind: "chip", text: brief.valueChip, fields: ["valueChip"] });
  }
  if (brief.valueLines.length > 0) {
    components.push({
      kind: "lines",
      lines: brief.valueLines,
      emphasis: "primary",
      fields: ["valueLines"],
    });
  }
  // The photograph carries the frame and the promise sits over it, so it is the
  // scene's ground rather than one of its components. With no photograph the
  // theme's ink shows through, which is the designed state, not a hole.
  return {
    layout: "full-bleed-overlay",
    components,
    ...backdropFor(brief.visuals.value, "hero", "visuals.value"),
  };
}

/**
 * What happens — one programme at a time when there is more than one.
 *
 * A numbered list of three is three messages on one slide, and the narration
 * line for it can only manage 「いろいろあります」. Given its own picture, each
 * programme gets a number set large, its own words at a size that can be read,
 * and a line of narration that says what it actually is. With a single
 * programme (or none) the scene is the list it always was.
 */
function programScene(brief: EventCmBrief, index?: number): Scene {
  const components: SceneComponent[] = [];
  const at = index ?? 0;
  const one = brief.programs[at] ?? null;
  // How many agenda pictures this film actually has — the template's three,
  // less the ones deleted. Asked of the plan rather than of `programs.length`,
  // which counts items and no longer counts pictures.
  const total =
    eventCmScenePlan(brief).filter((scene) => scene.role === "program").length ||
    1;

  if (brief.programsHeading) {
    components.push({
      kind: "kicker",
      text: brief.programsHeading,
      fields: ["programsHeading"],
    });
  }
  // The numeral is the scene's own structure: it says which of how many without
  // a word, which is what lets three consecutive pictures read as one programme
  // each rather than as three unrelated slides. Drawn even when the slot has no
  // item yet, because the template has three agenda pictures whatever this
  // event has put in them — the earlier fallback borrowed the WHOLE list for an
  // unfilled slot, which said the same thing three times.
  components.push({
    kind: "stat",
    value: `${at + 1}`,
    unit: `/ ${total}`,
    fields: ["programs"],
  });
  if (one) {
    components.push({
      kind: "lines",
      lines: [one.title],
      emphasis: "primary",
      fields: ["programs"],
    });
  }
  // Held well back (`support`): the list is what this scene says, and the room
  // it was photographed in is what it says it in.
  return {
    layout: "numbered-stack",
    components,
    ...backdropFor(brief.visuals.programs, "support", "visuals.programs"),
  };
}

function guestsScene(brief: EventCmBrief): Scene {
  return {
    layout: "row",
    components: [
      ...(brief.guestsHeading
        ? [
            {
              kind: "kicker",
              text: brief.guestsHeading,
              fields: ["guestsHeading"],
            } as SceneComponent,
          ]
        : []),
      {
        kind: "people",
        people: brief.guests,
        // The list and each portrait separately: correcting who is announced
        // and choosing the picture of one of them are different decisions, and
        // the panel has to be able to offer both.
        fields: ["guests", ...brief.guests.map((_, index) => `guests[${index}].photo`)],
      },
    ],
  };
}

function ctaScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [
    {
      kind: "datetime",
      date: brief.schedule.date,
      weekday: brief.schedule.weekday,
      time: brief.schedule.time,
      // One component, three facts. The storyboard offers all three rather than
      // picking one, because "直す" on a date that shows a time too would
      // silently be the wrong field.
      fields: ["schedule.date", "schedule.time", "schedule.weekday"],
    },
  ];
  // Facts nobody confirmed never appear. A null venue leaves rather than
  // becoming "未定" (deliverable-architecture §17.2).
  if (brief.schedule.venue) {
    components.push({
      kind: "body",
      text: brief.schedule.venue,
      emphasis: "caption",
      fields: ["schedule.venue"],
    });
  }
  if (brief.schedule.fee) {
    components.push({
      kind: "body",
      text: brief.schedule.fee,
      emphasis: "caption",
      fields: ["schedule.fee"],
    });
  }
  components.push({ kind: "rule", length: "short" });
  if (brief.cta) components.push({ kind: "cta", text: brief.cta, fields: ["cta"] });
  if (brief.logos.length > 0) {
    components.push({
      kind: "logoRow",
      // Same reason as the mark scene: the credits row sits on the ink ground.
      logos: brief.logos.map((logo) => ({
        ...logo,
        treatment: logo.treatment ?? "knockout",
      })),
      fields: ["logos"],
    });
  }
  if (brief.footnote) {
    components.push({
      kind: "body",
      text: brief.footnote,
      emphasis: "caption",
      fields: ["footnote"],
    });
  }
  return {
    layout: "corner-credit",
    components,
    ...backdropFor(brief.visuals.closing, "support", "visuals.closing"),
  };
}

/**
 * The one picture for one scene role.
 *
 * One message per picture, one line of narration per picture. An earlier version
 * returned two scenes for `program` when there were speakers, which meant a
 * single narration line ran across a cut — and the storyboard and the film then
 * disagreed about how many times the screen changes. Speakers are their own
 * scene now, with their own line, and are dropped entirely when nobody is
 * announced (`eventCmScenePlan`).
 */
export function sceneForRole(
  role: EventCmSceneRole,
  brief: EventCmBrief,
  /** Which item, for roles that repeat (programmes). */
  index?: number,
): Scene {
  switch (role) {
    case "logoIn":
      return markScene(brief, true);
    case "title":
      return titleScene(brief);
    case "value":
      return valueScene(brief);
    case "program":
      return programScene(brief, index);
    case "guests":
      return guestsScene(brief);
    case "cta":
      return ctaScene(brief);
    case "logoOut":
      return markScene(brief, false);
  }
}
