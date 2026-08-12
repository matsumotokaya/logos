import { hexToRgb, isGrayscale, luminance } from "@/lib/color";

// Assigning palette roles from what a page actually renders.
//
// Lives here rather than in the inspect-url route because it is a rule with a
// judgment in it — which of a site's colours is "the accent" — and rules with
// judgments have to be testable. §17.2: exhaust what can be decided by rule
// before reaching for a model.

export interface PaletteEvidence {
  /** Colours sampled from the logo mark, most present first. */
  logoColors: string[];
  /** Colours of buttons and links, most used first, with how many carried it. */
  interactive: Array<{ hex: string; count: number }>;
  /** Page backgrounds, largest area first. */
  backgrounds: string[];
  /** Text colours, largest area first. */
  texts: string[];
  /**
   * Hex literals found in the markup, most frequent first, plus any
   * <meta name="theme-color">.
   *
   * Never used for the accent — see assignPaletteRoles. A colour written in
   * the page source may be the brand's, or a plugin's default, or the CMS's
   * whole unused preset palette. Kept only as a last resort for the primary
   * when the page painted nothing identifiable.
   */
  hints: string[];
}

/**
 * How many elements must wear a colour before it counts as a choice.
 *
 * Two links tinted #007aff are Safari's default, not a brand decision. Three
 * is where "somebody styled this" starts being the better explanation.
 */
export const MIN_INTERACTIVE_USES = 3;

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Whether two colours can hold different roles — i.e. whether a viewer would
 * see them as two colours at all.
 *
 * Two measures, because either one alone gets a case wrong:
 *
 * - **Lightness.** Raw RGB distance flatters dark colours: #111111 and #000000
 *   are 29 apart by Euclidean distance and indistinguishable on a screen. A
 *   contrast ratio says what the eye says — 1.11, i.e. the same black.
 * - **Hue.** Contrast alone would call #0000ff and #4d4d4d the same role, since
 *   their luminances nearly match. RGB distance separates them at once.
 *
 * So: different if they differ in lightness OR in colour. The thresholds are
 * set where "is that a second colour or the same one?" stops being a question.
 */
export const MIN_CONTRAST_RATIO = 1.35;
export const MIN_RGB_DISTANCE = 60;

export function colorDistance(a: string, b: string): number {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return Math.sqrt(
    (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2,
  );
}

export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const [hi, lo] = first > second ? [first, second] : [second, first];
  return (hi + 0.05) / (lo + 0.05);
}

export const readsAsDifferentColor = (a: string, b: string): boolean =>
  contrastRatio(a, b) >= MIN_CONTRAST_RATIO || colorDistance(a, b) >= MIN_RGB_DISTANCE;

const distinctFrom = (color: string, taken: string[]): boolean =>
  taken.every((other) => readsAsDifferentColor(color, other));

/**
 * Assign palette roles from captured evidence.
 *
 * The accent is the one role allowed to come back missing. A site that paints
 * everything in one near-black has no accent, and recording #000000 next to a
 * primary of #080808 would state that it has one — after which every renderer
 * downstream believes it can highlight something and cannot. An absent accent
 * is information: it tells the video seeder to supply its own, labelled as the
 * tool's proposal rather than as the brand's colour.
 */
export function assignPaletteRoles(evidence: PaletteEvidence): Record<string, string> {
  const clean = (values: string[]) => values.filter((value) => HEX.test(value));
  const logoColors = clean(evidence.logoColors);
  const interactive = evidence.interactive.filter((value) => HEX.test(value.hex));
  const backgrounds = clean(evidence.backgrounds);
  const texts = clean(evidence.texts);
  const hints = clean(evidence.hints);

  const primary = logoColors[0] ?? interactive[0]?.hex ?? hints[0] ?? backgrounds[0];
  if (!primary) return {};

  // An accent must be PAINTED ON THE PAGE. Hex literals in the markup are not
  // evidence of what a brand looks like, they are evidence of what shipped in
  // the stylesheet — and a CMS ships its entire default palette whether or not
  // a single pixel uses it. wealthpark-lab.com offered #32373c and then
  // #abb8c3 this way; both are WordPress stock colours, and neither appears
  // anywhere on the rendered page. No threshold fixes that, because the
  // problem is the source, not the shade.
  //
  // Of the colours the page does paint, two things still disqualify a
  // candidate:
  //
  //   - it reads as the primary (see readsAsDifferentColor)
  //   - it is a grey. Hairlines, dividers and chrome are structure, not accent.
  //
  // And it has to be worn by enough elements to be a choice rather than a
  // browser default — two links tinted #007aff are Safari, not a decision.
  //
  // Together these leave a monochrome brand with no accent at all, which is
  // the true answer for one.
  const accent = [
    ...interactive
      .filter((value) => value.count >= MIN_INTERACTIVE_USES)
      .map((value) => value.hex),
    ...logoColors,
  ].find((color) => distinctFrom(color, [primary]) && !isGrayscale(color));

  // Surface is the next-largest background, whatever it is. Distinctness is
  // deliberately NOT required here: a panel that sits a shade off the page
  // (#f7f7f7 on #ffffff) is the commonest surface there is, and demanding that
  // it read as a different colour would skip past it to something dramatic.
  const background = backgrounds[0];
  const surface = backgrounds.find((color) => color !== background);
  const text = texts[0];

  const roles: Array<[string, string | undefined]> = [
    ["primary", primary],
    ["accent", accent],
    ["background", background],
    ["surface", surface ?? background],
    ["text", text],
  ];
  return Object.fromEntries(
    roles.filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
