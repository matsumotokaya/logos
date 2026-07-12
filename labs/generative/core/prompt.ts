// Prompt assembly — the harness's textual half.
//
// Rule from the requirement doc (E-2): the raw user prompt is NEVER sent to
// a model. The template's skeleton leads (existence first: "ロゴを何として
// 存在させるか"), user context is sanitized and wrapped into the declared
// slot, and the dial axes append explicit fidelity directives so shape/color/
// text/world holds are stated in words the model can act on.
//
// Isomorphic and deterministic: the client renders the identical string as a
// live preview — showing the exact prompt is part of "計測し、見せる".

import type { Dials, ExpressionTemplate } from "./expression-format";

export const MAX_CONTEXT_CHARS = 160;

/**
 * User context (industry / keywords) → a single safe line. Strips characters
 * that could break out of the wrapper or read as instructions to the model.
 */
export function sanitizeContext(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["“”'`{}<>\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTEXT_CHARS);
}

const pick = (hi: string, mid: string, lo: string) => (v: number) =>
  v >= 0.75 ? hi : v >= 0.45 ? mid : lo;

const shapeDirective = pick(
  "Preserve the exact geometry, proportions and silhouette of the logo from the reference image; do not redraw or restyle its shapes.",
  "Keep the logo clearly recognizable; the medium may texture its surface but must not alter its structure.",
  "The logo may be loosely reinterpreted through the medium as long as its overall gesture survives.",
);

const textDirective = pick(
  "Reproduce any lettering in the logo exactly, character by character; never invent glyphs.",
  "Keep any lettering legible even where the medium distresses it.",
  "Lettering may be abstracted; legibility is not required.",
);

function colorDirective(v: number, palette: string[]): string {
  const swatch = palette.length > 0 ? ` (${palette.join(", ")})` : "";
  if (v >= 0.75) return `Stay faithful to the brand colors${swatch}.`;
  if (v >= 0.45)
    return `Echo the brand palette${swatch} while allowing the scene's own light to tint it.`;
  return "Color may drift freely from the original palette.";
}

function worldDirective(v: number): string | null {
  if (v >= 0.75)
    return "Let the environment breathe — wide, atmospheric context around the mark.";
  if (v <= 0.45)
    return "Plain, restrained backdrop; the logo dominates the frame.";
  return null;
}

export type AssembledPrompt = {
  prompt: string;
  negative?: string;
  /** The sanitized context actually used ("" when none). */
  context: string;
};

/**
 * Skeleton order: existence → material → environment → light → camera →
 * mood → wrapped user context → dial directives.
 */
export function assemblePrompt(
  template: ExpressionTemplate,
  dials: Dials,
  rawContext: string | undefined,
  palette: string[],
): AssembledPrompt {
  const s = template.prompt;
  const parts: string[] = [s.existence];
  for (const seg of [s.material, s.environment, s.light, s.camera, s.mood])
    if (seg) parts.push(seg);

  const context = rawContext ? sanitizeContext(rawContext) : "";
  if (context) {
    const wrap = s.contextWrap ?? "The brand's context: {context}.";
    parts.push(wrap.replace("{context}", context));
  }

  parts.push(shapeDirective(dials.shape));
  parts.push(colorDirective(dials.color, palette));
  parts.push(textDirective(dials.text));
  const world = worldDirective(dials.world);
  if (world) parts.push(world);

  const prompt = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(" ");

  return { prompt, negative: s.negative, context };
}
