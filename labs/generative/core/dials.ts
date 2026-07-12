// Dial presets (E-3, Phase E1 scope).
//
// The four axes exist internally from day one, but Phase E1 exposes only the
// three presets (厳密/バランス/自由) — the two-tier UI's first tier. Phase E3
// adds per-axis controls on top of the same resolution logic.
//
// Resolution semantics:
//   1. Start from the global preset vector.
//   2. A template's dials.defaults redefine what "バランス" means for it
//      (strict/free stay global so the three stops feel consistent lab-wide).
//   3. dials.locks always win — the axis is pinned regardless of preset.
//
// Isomorphic: used by the server (mapping → engine params) and by the client
// (prompt preview shows exactly what will run).

import type { Dials, ExpressionTemplate } from "./expression-format";
import { DIAL_AXES } from "./expression-format";

export type PresetId = "strict" | "balanced" | "free";

export const PRESET_ORDER: PresetId[] = ["strict", "balanced", "free"];

export const PRESETS: Record<
  PresetId,
  { label: string; descriptionJa: string; dials: Dials }
> = {
  strict: {
    label: "厳密",
    descriptionJa: "ロゴの造形・色・文字をできる限り保つ。逸脱は素材の表面感まで",
    dials: { shape: 0.9, color: 0.9, text: 0.9, world: 0.25 },
  },
  balanced: {
    label: "バランス",
    descriptionJa: "ロゴが判別できる範囲で、素材と環境に馴染ませる",
    dials: { shape: 0.6, color: 0.65, text: 0.7, world: 0.55 },
  },
  free: {
    label: "自由",
    descriptionJa: "世界観を優先し、ロゴの再解釈を許容する。当たりを引きにいく設定",
    dials: { shape: 0.3, color: 0.35, text: 0.4, world: 0.85 },
  },
};

/** Preset → effective 4-axis dials for one template (locks applied last). */
export function resolveDials(
  preset: PresetId,
  template: ExpressionTemplate,
): Dials {
  const resolved = { ...PRESETS[preset].dials };
  if (preset === "balanced" && template.dials?.defaults) {
    for (const axis of DIAL_AXES) {
      const v = template.dials.defaults[axis];
      if (v !== undefined) resolved[axis] = v;
    }
  }
  for (const axis of DIAL_AXES) {
    const lock = template.dials?.locks?.[axis];
    if (lock) resolved[axis] = lock.value;
  }
  return resolved;
}
