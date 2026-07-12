// The `logos-expression-template@1` format — the canonical spec for
// expression templates in the exploration mode (Generative Lab, E-2).
//
// An expression template is one "art direction": not "neon sign" but
// "1980s Tokyo alley neon" — world, era and shooting style included.
// Templates are data, not code: a directory with template.json, scanned and
// validated server-side. Adding one must never require a code change.
//
// The raw user prompt is NEVER sent to a model. Templates own the prompt
// skeleton (existence-first ordering); sanitized user context is wrapped
// into a declared slot (see core/prompt.ts).
//
// Isomorphic module: types + validation only, no fs / no sharp.

export const EXPRESSION_FORMAT = "logos-expression-template@1";

/** The six-taxonomy system from the requirement doc (E-2). */
export type Taxonomy =
  | "material" // ①マテリアル変換
  | "environment" // ②環境統合
  | "stylization" // ③様式化・アートディレクション
  | "derivative" // ④展開・派生
  | "typography" // ⑤タイポグラフィ演出
  | "cinematic"; // ⑥シネマティック・キーアート

export const TAXONOMY_LABELS: Record<Taxonomy, string> = {
  material: "マテリアル変換",
  environment: "環境統合",
  stylization: "様式化",
  derivative: "展開・派生",
  typography: "タイポグラフィ演出",
  cinematic: "シネマティック",
};

/** The three-engine constellation (E-1). Gemini lands with Phase E3. */
export type EngineId = "flux2" | "recraft" | "gemini";

export type LogoType = "symbol" | "wordmark" | "combination";

export const LOGO_TYPE_LABELS: Record<LogoType, string> = {
  symbol: "シンボル型",
  wordmark: "ワードマーク型",
  combination: "複合型",
};

/** The four deviation-control axes (E-3), each 0–1 where 1 = hold tight. */
export type DialAxis = "shape" | "color" | "text" | "world";

export const DIAL_AXES: DialAxis[] = ["shape", "color", "text", "world"];

export const DIAL_LABELS: Record<DialAxis, string> = {
  shape: "形状保持",
  color: "色保持",
  text: "文字保持",
  world: "世界観自由度",
};

export type Dials = Record<DialAxis, number>;

/** A template may pin an axis (e.g. "文字保持はこの表現では無意味なので固定"). */
export type DialLock = { value: number; reasonJa?: string };

/**
 * Prompt skeleton, assembled in this order (existence first — "ロゴを何と
 * して存在させるか" leads every prompt, per the requirement doc).
 */
export type PromptSkeleton = {
  existence: string;
  material?: string;
  environment?: string;
  light?: string;
  camera?: string;
  mood?: string;
  /**
   * Wraps the sanitized user context (industry / keywords). Must contain
   * the literal `{context}`. Omitted from the prompt when the user typed
   * nothing.
   */
  contextWrap?: string;
  /** Negative prompt (engines that support it; ignored otherwise). */
  negative?: string;
};

/**
 * Engine parameter initial values. Which fields apply depends on the engine;
 * unknown-to-the-engine fields are ignored by its provider.
 */
export type EngineParams = {
  /** flux2: diffusion steps. */
  steps?: number;
  /** flux2: prompt adherence (before dial mapping adds its share). */
  guidanceScale?: number;
  /** recraft: image_to_image deviation from source, 0–1 (before mapping). */
  strength?: number;
  /** recraft: base style id, e.g. "realistic_image" / "digital_illustration". */
  style?: string;
  /**
   * Future brand-trained models (LoRA / custom): accepted through the whole
   * stack but unused in Phase E1 — the interface requirement from the
   * "ブランド固有学習" section. Do not implement behavior for it yet.
   */
  customModelId?: string;
};

/**
 * Dial→parameter mapping tuning (E-3: implementation values must be
 * per-template tunable, never hardcoded). Defaults live in core/mapping.ts.
 */
export type MappingTuning = {
  /** recraft: strength = base + world*worldGain − shape*shapeGain (clamped). */
  strengthBase?: number;
  strengthShapeGain?: number;
  strengthWorldGain?: number;
  /** flux2: guidance = base + shape*shapeGain. */
  guidanceBase?: number;
  guidanceShapeGain?: number;
};

export type ExpressionTemplate = {
  format: typeof EXPRESSION_FORMAT;
  /** Must equal the template's directory name. */
  id: string;
  /** The art direction, in English (doubles as prompt vocabulary). */
  name: string;
  nameJa: string;
  taxonomy: Taxonomy;
  engine: EngineId;
  prompt: PromptSkeleton;
  engineParams?: EngineParams;
  dials?: {
    /** Per-axis override of what "バランス" means for this template. */
    defaults?: Partial<Dials>;
    locks?: Partial<Record<DialAxis, DialLock>>;
  };
  mapping?: MappingTuning;
  /** Which logo anatomies this art direction works for (E-5 declaration). */
  logoTypes: LogoType[];
  /** Output size; engines clamp to their own limits. Default 1024×1024. */
  output?: { width?: number; height?: number };
  /** Impression tags for catalog filtering. */
  impressions?: string[];
  notesJa?: string;
};

const TAXONOMIES = Object.keys(TAXONOMY_LABELS) as Taxonomy[];
const ENGINES: EngineId[] = ["flux2", "recraft", "gemini"];
const LOGO_TYPES = Object.keys(LOGO_TYPE_LABELS) as LogoType[];

export type ValidationResult =
  | { ok: true; template: ExpressionTemplate }
  | { ok: false; errors: string[] };

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function num01(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function optStr(v: unknown, name: string, errors: string[]) {
  if (v !== undefined && typeof v !== "string") errors.push(`${name}: 文字列`);
}

export function validateExpressionTemplate(
  json: unknown,
  expectedId?: string,
): ValidationResult {
  const errors: string[] = [];
  if (!isRec(json)) return { ok: false, errors: ["template.json がオブジェクトではない"] };

  if (json.format !== EXPRESSION_FORMAT)
    errors.push(`format: "${EXPRESSION_FORMAT}" が必要(実際: ${JSON.stringify(json.format)})`);
  if (!str(json.id)) errors.push("id: 文字列が必要");
  else if (expectedId && json.id !== expectedId)
    errors.push(`id: ディレクトリ名 "${expectedId}" と一致していない("${json.id}")`);
  if (!str(json.name)) errors.push("name: 文字列が必要(アートディレクションの英名)");
  if (!str(json.nameJa)) errors.push("nameJa: 文字列が必要");
  if (!TAXONOMIES.includes(json.taxonomy as Taxonomy))
    errors.push(`taxonomy: ${TAXONOMIES.join("/")} のいずれかが必要`);
  if (!ENGINES.includes(json.engine as EngineId))
    errors.push(`engine: ${ENGINES.join("/")} のいずれかが必要`);

  const prompt = json.prompt;
  if (!isRec(prompt) || !str(prompt.existence)) {
    errors.push("prompt.existence: 文字列が必要(「ロゴを何として存在させるか」が先頭)");
  } else {
    for (const k of ["material", "environment", "light", "camera", "mood", "negative"])
      optStr(prompt[k], `prompt.${k}`, errors);
    if (prompt.contextWrap !== undefined) {
      if (typeof prompt.contextWrap !== "string" || !prompt.contextWrap.includes("{context}"))
        errors.push("prompt.contextWrap: {context} を含む文字列が必要");
    }
  }

  if (json.engineParams !== undefined) {
    const p = json.engineParams;
    if (!isRec(p)) errors.push("engineParams: オブジェクト");
    else {
      if (p.steps !== undefined && !(typeof p.steps === "number" && p.steps >= 1 && p.steps <= 60))
        errors.push("engineParams.steps: 1〜60 の数値");
      if (p.guidanceScale !== undefined && !(typeof p.guidanceScale === "number" && p.guidanceScale >= 0 && p.guidanceScale <= 15))
        errors.push("engineParams.guidanceScale: 0〜15 の数値");
      if (p.strength !== undefined && !num01(p.strength))
        errors.push("engineParams.strength: 0〜1 の数値");
      optStr(p.style, "engineParams.style", errors);
      optStr(p.customModelId, "engineParams.customModelId", errors);
    }
  }

  if (json.dials !== undefined) {
    const d = json.dials;
    if (!isRec(d)) errors.push("dials: オブジェクト");
    else {
      if (d.defaults !== undefined) {
        if (!isRec(d.defaults)) errors.push("dials.defaults: オブジェクト");
        else
          for (const axis of Object.keys(d.defaults)) {
            if (!DIAL_AXES.includes(axis as DialAxis))
              errors.push(`dials.defaults.${axis}: 未知の軸(${DIAL_AXES.join("/")})`);
            else if (!num01((d.defaults as Rec)[axis]))
              errors.push(`dials.defaults.${axis}: 0〜1 の数値`);
          }
      }
      if (d.locks !== undefined) {
        if (!isRec(d.locks)) errors.push("dials.locks: オブジェクト");
        else
          for (const axis of Object.keys(d.locks)) {
            const lock = (d.locks as Rec)[axis];
            if (!DIAL_AXES.includes(axis as DialAxis))
              errors.push(`dials.locks.${axis}: 未知の軸(${DIAL_AXES.join("/")})`);
            else if (!isRec(lock) || !num01(lock.value))
              errors.push(`dials.locks.${axis}: { value: 0〜1 } が必要`);
          }
      }
    }
  }

  if (json.mapping !== undefined) {
    const m = json.mapping;
    if (!isRec(m)) errors.push("mapping: オブジェクト");
    else
      for (const k of Object.keys(m)) {
        if (!["strengthBase", "strengthShapeGain", "strengthWorldGain", "guidanceBase", "guidanceShapeGain"].includes(k))
          errors.push(`mapping.${k}: 未知のチューニングキー`);
        else if (typeof (m as Rec)[k] !== "number")
          errors.push(`mapping.${k}: 数値`);
      }
  }

  if (!Array.isArray(json.logoTypes) || json.logoTypes.length === 0 ||
      !json.logoTypes.every((t) => LOGO_TYPES.includes(t as LogoType)))
    errors.push(`logoTypes: ${LOGO_TYPES.join("/")} の非空配列が必要`);

  if (json.output !== undefined) {
    const o = json.output;
    const okDim = (v: unknown) =>
      v === undefined || (typeof v === "number" && v >= 256 && v <= 2048);
    if (!isRec(o) || !okDim(o.width) || !okDim(o.height))
      errors.push("output: { width?, height? }(256〜2048)");
  }

  if (json.impressions !== undefined &&
      (!Array.isArray(json.impressions) || !json.impressions.every(str)))
    errors.push("impressions: 文字列配列");
  if (json.notesJa !== undefined && typeof json.notesJa !== "string")
    errors.push("notesJa: 文字列");

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, template: json as unknown as ExpressionTemplate };
}
