// Dial axes → engine parameters (E-3's mapping layer).
//
// The default coefficients live here as named constants — never inline in a
// provider — and every one of them can be overridden per template via
// template.mapping (the requirement: tunable, not hardcoded). Prompt-side
// effects of the dials (fidelity directives, palette clauses, environment
// richness) are handled in core/prompt.ts; this module owns the numeric
// parameters only.
//
// Isomorphic: the client uses it to preview the exact run configuration.

import type {
  Dials,
  EngineId,
  EngineParams,
  ExpressionTemplate,
  MappingTuning,
} from "./expression-format";

export const DEFAULT_MAPPING: Required<MappingTuning> = {
  // recraft image_to_image: strength 0 = stay at the source, 1 = leave it.
  // strict(shape .9, world .25) → ~0.16 / free(shape .3, world .85) → ~0.61
  strengthBase: 0.55,
  strengthShapeGain: 0.5,
  strengthWorldGain: 0.25,
  // flux2: higher guidance = tighter prompt adherence; shape-hold leans on
  // the preservation directives in the prompt, so guidance rises with it.
  guidanceBase: 2.5,
  guidanceShapeGain: 2.0,
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** Resolve the final engine parameters for one generation. */
export function mapDialsToParams(
  engine: EngineId,
  dials: Dials,
  template: ExpressionTemplate,
): EngineParams {
  const tune = { ...DEFAULT_MAPPING, ...template.mapping };
  const base = template.engineParams ?? {};

  if (engine === "recraft") {
    const strength = clamp(
      (base.strength ?? tune.strengthBase) +
        dials.world * tune.strengthWorldGain -
        dials.shape * tune.strengthShapeGain,
      0.05,
      0.95,
    );
    return {
      ...base,
      strength: Math.round(strength * 100) / 100,
      style: base.style ?? "realistic_image",
    };
  }

  if (engine === "flux2") {
    const guidance = clamp(
      (base.guidanceScale ?? tune.guidanceBase) +
        dials.shape * tune.guidanceShapeGain,
      1,
      10,
    );
    return {
      ...base,
      guidanceScale: Math.round(guidance * 10) / 10,
      steps: base.steps ?? 28,
    };
  }

  // gemini (Phase E3): multi-turn editing has no numeric dial mapping yet.
  return { ...base };
}
