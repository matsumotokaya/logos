// The component vocabulary — what a scene can be made of.
//
// This is the layer that decides what is FIXED and what is FREE, and that line
// is the whole design:
//
//   FIXED  the set of components, their parameters, what each one does when it
//          has nothing to show, and how much text each can carry legibly.
//   FREE   which components a scene uses, how they are arranged, what they
//          say, and which one is loudest. That is where an LLM works, and it
//          is why the output is not obviously systematic.
//
// Getting the grain right matters more than the list itself. Atoms (text, box,
// image) make every combination possible and every result average. Whole
// finished scenes make quality high and coverage nil. These sit in between:
// each one is a thing a commercial video actually contains — a person, a
// programme list, a date — with the typography judgment already inside it.
//
// Rendering lives in remotion/kit/render/*; this file is the contract, so it
// stays free of React and can be reasoned about (and tested) on its own.

import type { EventPhoto } from "@/remotion/event/types";

/**
 * How loud a component is on its stage. Not a font size — the theme decides
 * what each step measures (theme.ts). A scene normally carries exactly one
 * `hero`; two heroes is the commonest way a layout stops reading as designed.
 */
export const EMPHASIS_LEVELS = ["hero", "primary", "secondary", "caption"] as const;
export type Emphasis = (typeof EMPHASIS_LEVELS)[number];

export const COMPONENT_KINDS = [
  "kicker",
  "heading",
  "subheading",
  "lines",
  "body",
  "chip",
  "list",
  "person",
  "people",
  "logo",
  "logoRow",
  "stat",
  "datetime",
  "cta",
  "image",
  "rule",
  "mark",
] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export interface PersonParams {
  name: string;
  role: string;
  photo: EventPhoto | null;
}

/** One component instance in a scene. Discriminated by `kind`. */
export type SceneComponent =
  /** Small label riding above the main statement: a series name, a round. */
  | { kind: "kicker"; text: string; emphasis?: Emphasis }
  /** The statement the scene exists to make. */
  | { kind: "heading"; text: string; emphasis?: Emphasis }
  | { kind: "subheading"; text: string; emphasis?: Emphasis }
  /** Two or three short lines stacked as verse — a claim broken for rhythm,
   *  not a paragraph that happened to wrap. */
  | { kind: "lines"; lines: string[]; emphasis?: Emphasis }
  | { kind: "body"; text: string; emphasis?: Emphasis }
  /** A short label in a ruled or rounded enclosure. */
  | { kind: "chip"; text: string; emphasis?: Emphasis }
  /** Ordered items. `numbered` puts a large numeral beside each. */
  | { kind: "list"; items: string[]; numbered?: boolean; emphasis?: Emphasis }
  | { kind: "person"; person: PersonParams; emphasis?: Emphasis }
  | { kind: "people"; people: PersonParams[]; emphasis?: Emphasis }
  | { kind: "logo"; src: string | null; name: string; scale?: number; emphasis?: Emphasis }
  | {
      kind: "logoRow";
      logos: Array<{ src: string | null; name: string; scale?: number }>;
      emphasis?: Emphasis;
    }
  | { kind: "stat"; value: string; unit?: string; label?: string; emphasis?: Emphasis }
  /** Dates need their own setting: the numerals, the weekday and the time are
   *  three different sizes in every well-set announcement. */
  | { kind: "datetime"; date: string; weekday?: string; time?: string; emphasis?: Emphasis }
  | { kind: "cta"; text: string; emphasis?: Emphasis }
  | { kind: "image"; photo: EventPhoto | null; emphasis?: Emphasis }
  /** Structure, not decoration: in this art direction a rule carries weight. */
  | { kind: "rule"; length?: "short" | "full"; emphasis?: Emphasis }
  | { kind: "mark"; glyph?: string; emphasis?: Emphasis };

/**
 * What a component does with nothing in it.
 *
 * Carried over from the event template's founding rule — a missing asset gets
 * a *designed* substitute, never an empty box (README, 素材スロット). The
 * difference here is that the substitute belongs to the component rather than
 * being written into one hand-composed scene, so every future scene inherits
 * it.
 *
 * `omit` is for facts. A venue nobody has confirmed leaves the screen; it does
 * not become "未定" (deliverable-architecture §17.2).
 */
export type EmptyBehaviour =
  /** Draw the designed substitute described by `note`. */
  | { mode: "substitute"; note: string }
  /** Disappear. The layout closes up around it. */
  | { mode: "omit" };

export const EMPTY_BEHAVIOUR: Record<ComponentKind, EmptyBehaviour> = {
  kicker: { mode: "omit" },
  heading: { mode: "omit" },
  subheading: { mode: "omit" },
  lines: { mode: "omit" },
  body: { mode: "omit" },
  chip: { mode: "omit" },
  list: { mode: "omit" },
  person: {
    mode: "substitute",
    note: "写真の代わりに姓一文字のモノグラムをテーマの縁取りで描く",
  },
  people: {
    mode: "substitute",
    note: "写真の無い人物はモノグラムで、名前と肩書きは通常どおり組む",
  },
  logo: {
    mode: "substitute",
    note: "画像の代わりに社名をテーマの見出し書体でクレジット組みする",
  },
  logoRow: { mode: "substitute", note: "画像の無いロゴは社名のクレジット組みで並べる" },
  stat: { mode: "omit" },
  datetime: { mode: "omit" },
  cta: { mode: "omit" },
  image: {
    mode: "substitute",
    note: "テーマの地（墨のグラウンドと粒子など）をそのまま見せる",
  },
  rule: { mode: "omit" },
  mark: { mode: "omit" },
};

/** Whether this instance actually has anything to show. */
export function isEmpty(component: SceneComponent): boolean {
  switch (component.kind) {
    case "kicker":
    case "heading":
    case "subheading":
    case "body":
    case "chip":
    case "cta":
      return !component.text.trim();
    case "lines":
      return component.lines.every((line) => !line.trim());
    case "list":
      return component.items.every((item) => !item.trim());
    case "person":
      return !component.person.name.trim();
    case "people":
      return component.people.length === 0;
    case "logo":
      return !component.src && !component.name.trim();
    case "logoRow":
      return component.logos.length === 0;
    case "stat":
      return !component.value.trim();
    case "datetime":
      return !component.date.trim();
    case "image":
      return component.photo === null;
    case "rule":
    case "mark":
      return false;
  }
}

/** All the text a component sets, for fitting (fit.ts). */
export function textOf(component: SceneComponent): string[] {
  switch (component.kind) {
    case "kicker":
    case "heading":
    case "subheading":
    case "body":
    case "chip":
    case "cta":
      return [component.text];
    case "lines":
      return component.lines;
    case "list":
      return component.items;
    case "person":
      return [component.person.name, component.person.role];
    case "people":
      return component.people.flatMap((person) => [person.name, person.role]);
    case "logo":
      return component.src ? [] : [component.name];
    case "logoRow":
      return component.logos.filter((logo) => !logo.src).map((logo) => logo.name);
    case "stat":
      return [`${component.value}${component.unit ?? ""}`, component.label ?? ""];
    case "datetime":
      return [component.date, component.weekday ?? "", component.time ?? ""];
    case "image":
    case "rule":
    case "mark":
      return [];
  }
}

/** The emphasis a component takes when a scene does not say otherwise. */
export const DEFAULT_EMPHASIS: Record<ComponentKind, Emphasis> = {
  kicker: "caption",
  heading: "hero",
  subheading: "secondary",
  lines: "primary",
  body: "secondary",
  chip: "caption",
  list: "secondary",
  person: "secondary",
  people: "secondary",
  logo: "secondary",
  logoRow: "caption",
  stat: "primary",
  datetime: "primary",
  cta: "secondary",
  image: "hero",
  rule: "caption",
  mark: "caption",
};

export const emphasisOf = (component: SceneComponent): Emphasis =>
  component.emphasis ?? DEFAULT_EMPHASIS[component.kind];
