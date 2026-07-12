// The `logos-2d-template@1` format — the canonical spec for 2D stage templates.
//
// A template is a directory: template.json (this schema) + its assets.
// Designers author templates; engineering owns this format, its validation
// and the compositing pipeline. Adding a template must never require a code
// change — the server scans the templates directory and validates each one,
// surfacing errors in the catalog UI instead of failing silently.
//
// Isomorphic module: types + validation only, no fs / no sharp.

export const TEMPLATE_FORMAT = "logos-2d-template@1";

/** A point in template canvas coordinates (px in the design space). */
export type Point = [number, number];

/** Blend modes supported by the compositor (libvips names). */
export type BlendMode = "over" | "multiply" | "screen" | "overlay" | "soft-light";

/** How the logo's own colors are treated when printed onto the surface. */
export type LogoColorMode = "original" | "mono-dark" | "mono-light";

export type TemplateCategory = "print" | "fabric" | "signage" | "screen" | "product";

/** The four corners of the logo surface in canvas coordinates (perspective). */
export type SurfaceCorners = { tl: Point; tr: Point; br: Point; bl: Point };

export type DisplacementSpec = {
  /** RGB map asset: R shifts x, G shifts y, 128 = neutral. Scaled to output. */
  src: string;
  /** Max shift in canvas px at full deflection (scaled with output size). */
  strength: number;
};

export type ShadowSpec = {
  /** Blur radius in canvas px. */
  blur: number;
  /** 0–1. */
  opacity: number;
  /** Offset in canvas px. */
  dx: number;
  dy: number;
};

export type LogoSpec = {
  blend: BlendMode;
  /** 0–1, default 1. */
  opacity?: number;
  /** Default color treatment; the UI may override per render. */
  colorMode?: LogoColorMode;
  /**
   * Recommended placement in surface UV space (0–1 across the corner quad).
   * `width` is the logo width as a fraction of the surface width.
   */
  placement: { cx: number; cy: number; width: number };
  /** Clear space around the logo, as a fraction of the logo width. */
  clearSpace: number;
  /** Clamp for the effective width fraction (min-size / max-size rules). */
  minWidth: number;
  maxWidth: number;
  /** Optional contact shadow rendered from the warped logo's alpha. */
  shadow?: ShadowSpec;
};

export type LightingLayer = {
  /** Asset path relative to the template directory (SVG recommended). */
  src: string;
  blend: BlendMode;
  /** 0–1, default 1. */
  opacity?: number;
};

export type Template2D = {
  format: typeof TEMPLATE_FORMAT;
  /** Must equal the template's directory name. */
  id: string;
  name: string;
  nameJa: string;
  category: TemplateCategory;
  /** Design space; every output resolution scales from this. */
  canvas: { width: number; height: number };
  /** The stage artwork (SVG recommended — resolution independent). */
  stage: { src: string };
  surface: {
    corners: SurfaceCorners;
    displacement?: DisplacementSpec;
    logo: LogoSpec;
  };
  /** Composited over the placed logo, in order (baked lighting/shadows). */
  lighting?: LightingLayer[];
  /** Impression tags for catalog filtering, e.g. 上質 / クラフト. */
  impressions?: string[];
  notesJa?: string;
};

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  print: "印刷物",
  fabric: "ファブリック",
  signage: "サイネージ",
  screen: "スクリーン",
  product: "プロダクト",
};

const BLEND_MODES: BlendMode[] = ["over", "multiply", "screen", "overlay", "soft-light"];
const COLOR_MODES: LogoColorMode[] = ["original", "mono-dark", "mono-light"];
const CATEGORIES: TemplateCategory[] = ["print", "fabric", "signage", "screen", "product"];

/** Result of validating one template.json (plus whatever the server adds). */
export type ValidationResult =
  | { ok: true; template: Template2D }
  | { ok: false; errors: string[] };

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPoint(v: unknown): v is Point {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

function num(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function str(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** Relative asset path: no absolute paths, no parent traversal. */
function isSafeAssetPath(v: unknown): v is string {
  return str(v) && !v.startsWith("/") && !v.includes("..") && !v.includes("\\");
}

function checkLayer(l: unknown, where: string, errors: string[]) {
  if (!isRec(l)) return errors.push(`${where}: オブジェクトではない`);
  if (!isSafeAssetPath(l.src)) errors.push(`${where}.src: 相対パスの文字列が必要`);
  if (!BLEND_MODES.includes(l.blend as BlendMode))
    errors.push(`${where}.blend: ${BLEND_MODES.join("/")} のいずれかが必要`);
  if (l.opacity !== undefined && !(num(l.opacity) && l.opacity >= 0 && l.opacity <= 1))
    errors.push(`${where}.opacity: 0〜1 の数値`);
}

/** Signed area × 2 of the corner quad — also used to reject self-intersection. */
function quadIsConvex(c: SurfaceCorners): boolean {
  const pts = [c.tl, c.tr, c.br, c.bl];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 4];
    const [cx, cy] = pts[(i + 2) % 4];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (cross === 0) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Validate a parsed template.json. `expectedId` is the directory name — the
 * id must match so URLs, logs and the catalog stay consistent.
 */
export function validateTemplate(json: unknown, expectedId?: string): ValidationResult {
  const errors: string[] = [];
  if (!isRec(json)) return { ok: false, errors: ["template.json がオブジェクトではない"] };

  if (json.format !== TEMPLATE_FORMAT)
    errors.push(`format: "${TEMPLATE_FORMAT}" が必要(実際: ${JSON.stringify(json.format)})`);
  if (!str(json.id)) errors.push("id: 文字列が必要");
  else if (expectedId && json.id !== expectedId)
    errors.push(`id: ディレクトリ名 "${expectedId}" と一致していない("${json.id}")`);
  if (!str(json.name)) errors.push("name: 文字列が必要");
  if (!str(json.nameJa)) errors.push("nameJa: 文字列が必要");
  if (!CATEGORIES.includes(json.category as TemplateCategory))
    errors.push(`category: ${CATEGORIES.join("/")} のいずれかが必要`);

  if (!isRec(json.canvas) || !num(json.canvas.width) || !num(json.canvas.height) ||
      (json.canvas.width as number) <= 0 || (json.canvas.height as number) <= 0)
    errors.push("canvas: { width, height }(正の数値)が必要");

  if (!isRec(json.stage) || !isSafeAssetPath(json.stage.src))
    errors.push("stage.src: 相対パスの文字列が必要");

  const surface = json.surface;
  if (!isRec(surface)) {
    errors.push("surface: オブジェクトが必要");
  } else {
    const corners = surface.corners;
    if (!isRec(corners) || !isPoint(corners.tl) || !isPoint(corners.tr) ||
        !isPoint(corners.br) || !isPoint(corners.bl)) {
      errors.push("surface.corners: tl/tr/br/bl の各 [x, y] が必要");
    } else if (!quadIsConvex(corners as unknown as SurfaceCorners)) {
      errors.push("surface.corners: 凸の四角形ではない(自己交差または退化)");
    }

    if (surface.displacement !== undefined) {
      const d = surface.displacement;
      if (!isRec(d) || !isSafeAssetPath(d.src) || !num(d.strength) || (d.strength as number) < 0)
        errors.push("surface.displacement: { src, strength>=0 } が必要");
    }

    const logo = surface.logo;
    if (!isRec(logo)) {
      errors.push("surface.logo: オブジェクトが必要");
    } else {
      if (!BLEND_MODES.includes(logo.blend as BlendMode))
        errors.push(`surface.logo.blend: ${BLEND_MODES.join("/")} のいずれかが必要`);
      if (logo.opacity !== undefined && !(num(logo.opacity) && logo.opacity >= 0 && logo.opacity <= 1))
        errors.push("surface.logo.opacity: 0〜1 の数値");
      if (logo.colorMode !== undefined && !COLOR_MODES.includes(logo.colorMode as LogoColorMode))
        errors.push(`surface.logo.colorMode: ${COLOR_MODES.join("/")} のいずれか`);
      const p = logo.placement;
      if (!isRec(p) || !num(p.cx) || !num(p.cy) || !num(p.width) ||
          (p.width as number) <= 0 || (p.width as number) > 1)
        errors.push("surface.logo.placement: { cx, cy, width(0〜1] } が必要");
      if (!num(logo.clearSpace) || (logo.clearSpace as number) < 0)
        errors.push("surface.logo.clearSpace: 0以上の数値が必要");
      if (!num(logo.minWidth) || !num(logo.maxWidth) ||
          (logo.minWidth as number) <= 0 || (logo.maxWidth as number) > 1 ||
          (logo.minWidth as number) > (logo.maxWidth as number))
        errors.push("surface.logo.minWidth/maxWidth: 0 < min <= max <= 1 が必要");
      if (logo.shadow !== undefined) {
        const s = logo.shadow;
        if (!isRec(s) || !num(s.blur) || !num(s.opacity) || !num(s.dx) || !num(s.dy) ||
            (s.opacity as number) < 0 || (s.opacity as number) > 1)
          errors.push("surface.logo.shadow: { blur, opacity(0〜1), dx, dy } が必要");
      }
    }
  }

  if (json.lighting !== undefined) {
    if (!Array.isArray(json.lighting)) errors.push("lighting: 配列が必要");
    else json.lighting.forEach((l, i) => checkLayer(l, `lighting[${i}]`, errors));
  }
  if (json.impressions !== undefined &&
      (!Array.isArray(json.impressions) || !json.impressions.every(str)))
    errors.push("impressions: 文字列配列");
  if (json.notesJa !== undefined && typeof json.notesJa !== "string")
    errors.push("notesJa: 文字列");

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, template: json as unknown as Template2D };
}

/** Every asset path a template references (for existence checks). */
export function templateAssetPaths(t: Template2D): string[] {
  return [
    t.stage.src,
    ...(t.surface.displacement ? [t.surface.displacement.src] : []),
    ...(t.lighting ?? []).map((l) => l.src),
  ];
}
