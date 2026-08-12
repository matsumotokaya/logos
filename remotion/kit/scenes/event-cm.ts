import type { Scene } from "../layout";
import type { SceneComponent } from "../components";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import type { EventCmSceneRole } from "@/remotion/event-cm/types";

// The narrated event promo, written in the vocabulary.
//
// This is the acceptance test for the whole rewrite: if 世界が恋する日本酒
// cannot be rebuilt from these seventeen components and seven arrangements,
// the vocabulary is not finished. Everything the hand-composed version did is
// either here or is a gap worth naming.
//
// What each role gets is a real editorial decision, not a mapping table:
//
//   hook     the series and who is presenting, over texture. Quiet opening.
//   theme    the title. One hero per film, and this is it.
//   value    the promise, as verse, over the主役 photograph.
//   program  what happens, numbered — and the speakers if there are any.
//   cta      the date, the call, the credits. Space is the statement.
//
// Arrangements alternate deliberately (centre → centre → full-bleed → numbered
// → corner) because a film whose every scene is centred reads as a slide deck
// however well each slide is set.

function hookScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [];
  if (brief.seriesLabel) components.push({ kind: "kicker", text: brief.seriesLabel });
  components.push({ kind: "rule", length: "short" });
  if (brief.presenter) {
    components.push({ kind: "heading", text: brief.presenter, emphasis: "primary" });
  }
  return { layout: "centre-stack", components };
}

function themeScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [{ kind: "heading", text: brief.title }];
  if (brief.subtitle) components.push({ kind: "subheading", text: brief.subtitle });
  return { layout: "centre-stack", components };
}

function valueScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [];
  // The photograph carries the frame; the promise sits over it. With no photo
  // the theme's ground shows through, which is the designed state.
  if (brief.visuals.value) components.push({ kind: "image", photo: brief.visuals.value });
  if (brief.valueChip) components.push({ kind: "chip", text: brief.valueChip });
  if (brief.valueLines.length > 0) {
    components.push({ kind: "lines", lines: brief.valueLines, emphasis: "primary" });
  }
  return { layout: "full-bleed-overlay", components };
}

function programScene(brief: EventCmBrief): Scene {
  const components: SceneComponent[] = [];
  if (brief.programsHeading) components.push({ kind: "kicker", text: brief.programsHeading });
  if (brief.programs.length > 0) {
    components.push({
      kind: "list",
      items: brief.programs.map((program) => program.title),
      numbered: true,
    });
  }
  return { layout: "numbered-stack", components };
}

function guestsScene(brief: EventCmBrief): Scene {
  return {
    layout: "row",
    components: [
      ...(brief.guestsHeading
        ? [{ kind: "kicker", text: brief.guestsHeading } as SceneComponent]
        : []),
      { kind: "people", people: brief.guests },
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
    },
  ];
  // Facts nobody confirmed never appear. A null venue leaves rather than
  // becoming "未定" (deliverable-architecture §17.2).
  if (brief.schedule.venue) {
    components.push({ kind: "body", text: brief.schedule.venue, emphasis: "caption" });
  }
  if (brief.schedule.fee) {
    components.push({ kind: "body", text: brief.schedule.fee, emphasis: "caption" });
  }
  components.push({ kind: "rule", length: "short" });
  if (brief.cta) components.push({ kind: "cta", text: brief.cta });
  if (brief.logos.length > 0) components.push({ kind: "logoRow", logos: brief.logos });
  if (brief.footnote) {
    components.push({ kind: "body", text: brief.footnote, emphasis: "caption" });
  }
  return { layout: "corner-credit", components };
}

/**
 * The scenes for one narration beat.
 *
 * `program` returns two when there are speakers: the beat says one thing about
 * what happens, and the screen has room for both halves of it. Splitting here
 * rather than adding a sixth narration role keeps the script at five beats.
 */
export function scenesForRole(role: EventCmSceneRole, brief: EventCmBrief): Scene[] {
  switch (role) {
    case "hook":
      return [hookScene(brief)];
    case "theme":
      return [themeScene(brief)];
    case "value":
      return [valueScene(brief)];
    case "program":
      return brief.guests.length > 0
        ? [programScene(brief), guestsScene(brief)]
        : [programScene(brief)];
    case "cta":
      return [ctaScene(brief)];
  }
}
