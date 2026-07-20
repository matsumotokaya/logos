// Stage 2 of the Tier S palette pipeline: turn raw rendering evidence
// (computed-style histograms, interactive-element colors, CSS variables,
// logo pixels) into a small list of deterministic palette candidates, each
// carrying human-readable evidence. The VLM adjudicator may only pick from
// these candidates — it never invents colors.

export interface WeightedColor {
  hex: string;
  weight: number;
}

export interface InteractiveColor {
  hex: string;
  role: "background" | "text";
  count: number;
}

export interface CaptureEvidence {
  /** background-color / svg fill, weighted by on-screen area (px^2) */
  backgrounds: WeightedColor[];
  /** text color, weighted by amount of text (chars * fontSize^2) */
  texts: WeightedColor[];
  /** border colors, weighted by border length * width */
  borders: WeightedColor[];
  /** CSS-gradient background stops, weighted by painted area (px^2) —
   *  hero key visuals are usually here, not in backgrounds */
  gradients?: WeightedColor[];
  /** rendered-viewport pixel share 0..1 (photography, imagery, everything) */
  pixels?: WeightedColor[];
  /** dominant colors of the og:image key visual, share 0..1 */
  keyVisual?: WeightedColor[];
  /** colors used on interactive elements (a / button / inputs) */
  interactive: InteractiveColor[];
  /** :root CSS custom properties that resolve to a color */
  cssVars: { name: string; hex: string }[];
  /** dominant colors of the header logo / favicon, share 0..1 */
  logoColors: { hex: string; share: number }[];
}

export interface PaletteCandidate {
  hex: string;
  /** human-readable evidence lines, e.g. "背景面積42%" "ボタン/リンク14要素" */
  evidence: string[];
  bgShare: number;
  textShare: number;
  gradShare: number;
  pixelShare: number;
  keyVisualShare: number;
  interactiveCount: number;
  fromLogo: boolean;
  cssVarNames: string[];
  chroma: number;
}

// ---------- color math (sRGB → CIELAB, ΔE76) ----------

type Lab = { L: number; a: number; b: number };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToLab([r, g, b]: [number, number, number]): Lab {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [lin(r), lin(g), lin(b)];
  // sRGB D65
  const x = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) / 0.95047;
  const y = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
  const z = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labFor(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

export function deltaE(hexA: string, hexB: string): number {
  const a = labFor(hexA);
  const b = labFor(hexB);
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function chromaOf(hex: string): number {
  const lab = labFor(hex);
  return Math.sqrt(lab.a ** 2 + lab.b ** 2);
}

/** Snap a hex to the nearest candidate; returns the candidate hex and distance. */
export function nearestCandidate(
  hex: string,
  candidates: PaletteCandidate[]
): { hex: string; distance: number } | null {
  let best: { hex: string; distance: number } | null = null;
  for (const c of candidates) {
    const d = deltaE(hex, c.hex);
    if (!best || d < best.distance) best = { hex: c.hex, distance: d };
  }
  return best;
}

// ---------- clustering ----------

interface Cluster {
  hex: string; // representative = highest-weight member
  repWeight: number;
  lab: Lab;
  bgWeight: number;
  textWeight: number;
  borderWeight: number;
  gradWeight: number;
  pixelShare: number;
  keyVisualShare: number;
  interactiveCount: number;
  logoShare: number;
  cssVarNames: string[];
}

const CLUSTER_DELTA_E = 10;

function clusterEvidence(ev: CaptureEvidence): Cluster[] {
  const clusters: Cluster[] = [];

  const find = (hex: string): Cluster | null => {
    const lab = labFor(hex);
    for (const c of clusters) {
      const d = Math.sqrt(
        (c.lab.L - lab.L) ** 2 + (c.lab.a - lab.a) ** 2 + (c.lab.b - lab.b) ** 2
      );
      if (d < CLUSTER_DELTA_E) return c;
    }
    return null;
  };

  const upsert = (hex: string, weight: number, apply: (c: Cluster) => void) => {
    let c = find(hex);
    if (!c) {
      c = {
        hex,
        repWeight: weight,
        lab: labFor(hex),
        bgWeight: 0,
        textWeight: 0,
        borderWeight: 0,
        gradWeight: 0,
        pixelShare: 0,
        keyVisualShare: 0,
        interactiveCount: 0,
        logoShare: 0,
        cssVarNames: [],
      };
      clusters.push(c);
    } else if (weight > c.repWeight) {
      // keep the most-seen real color as the representative
      c.hex = hex;
      c.repWeight = weight;
      c.lab = labFor(hex);
    }
    apply(c);
  };

  const sorted = <T extends { weight: number }>(xs: T[]) =>
    [...xs].sort((a, b) => b.weight - a.weight);

  for (const e of sorted(ev.backgrounds)) upsert(e.hex, e.weight, (c) => (c.bgWeight += e.weight));
  for (const e of sorted(ev.texts)) upsert(e.hex, e.weight, (c) => (c.textWeight += e.weight));
  for (const e of sorted(ev.borders)) upsert(e.hex, e.weight, (c) => (c.borderWeight += e.weight));
  for (const e of sorted(ev.gradients ?? []))
    upsert(e.hex, e.weight, (c) => (c.gradWeight += e.weight));
  for (const e of sorted(ev.pixels ?? []))
    upsert(e.hex, e.weight * 1000, (c) => (c.pixelShare += e.weight));
  for (const e of sorted(ev.keyVisual ?? []))
    upsert(e.hex, e.weight * 1000, (c) => (c.keyVisualShare += e.weight));
  for (const e of ev.interactive) upsert(e.hex, e.count, (c) => (c.interactiveCount += e.count));
  for (const e of ev.logoColors) upsert(e.hex, e.share * 1000, (c) => (c.logoShare += e.share));
  for (const e of ev.cssVars) upsert(e.hex, 1, (c) => c.cssVarNames.push(e.name));

  return clusters;
}

// ---------- candidate selection ----------

const BRAND_VAR_RE = /(primary|accent|brand|main|theme|key)/i;
const MAX_CANDIDATES = 14;

export function buildPaletteCandidates(ev: CaptureEvidence): PaletteCandidate[] {
  const clusters = clusterEvidence(ev);
  if (clusters.length === 0) return [];

  const totalBg = clusters.reduce((s, c) => s + c.bgWeight, 0) || 1;
  const totalText = clusters.reduce((s, c) => s + c.textWeight, 0) || 1;
  const totalGrad = clusters.reduce((s, c) => s + c.gradWeight, 0) || 1;

  const toCandidate = (c: Cluster): PaletteCandidate => {
    const bgShare = c.bgWeight / totalBg;
    const textShare = c.textWeight / totalText;
    const gradShare = c.gradWeight / totalGrad;
    const evidence: string[] = [];
    if (bgShare >= 0.005) evidence.push(`背景面積${(bgShare * 100).toFixed(1)}%`);
    if (c.gradWeight > 0 && gradShare >= 0.05)
      evidence.push(`グラデーション背景${(gradShare * 100).toFixed(0)}%`);
    if (c.pixelShare >= 0.02)
      evidence.push(`画面ピクセル${(c.pixelShare * 100).toFixed(0)}%`);
    if (c.keyVisualShare >= 0.05)
      evidence.push(`キービジュアル(og:image)に${Math.round(c.keyVisualShare * 100)}%`);
    if (textShare >= 0.005) evidence.push(`テキスト量${(textShare * 100).toFixed(1)}%`);
    if (c.interactiveCount > 0)
      evidence.push(`ボタン/リンク${c.interactiveCount}要素で使用`);
    if (c.logoShare > 0.02) evidence.push(`ロゴに含まれる(${Math.round(c.logoShare * 100)}%)`);
    for (const name of c.cssVarNames.slice(0, 3)) evidence.push(`CSS変数 ${name}`);
    if (c.borderWeight > 0 && evidence.length === 0) evidence.push("ボーダー色として使用");
    return {
      hex: c.hex,
      evidence,
      bgShare,
      textShare,
      gradShare,
      pixelShare: c.pixelShare,
      keyVisualShare: c.keyVisualShare,
      interactiveCount: c.interactiveCount,
      fromLogo: c.logoShare > 0.02,
      cssVarNames: c.cssVarNames,
      chroma: chromaOf(c.hex),
    };
  };

  const all = clusters.map(toCandidate);

  const picked = new Map<string, PaletteCandidate>();
  const take = (xs: PaletteCandidate[], n: number) => {
    for (const x of xs.slice(0, n)) if (!picked.has(x.hex)) picked.set(x.hex, x);
  };

  // Backgrounds: largest painted areas.
  take([...all].sort((a, b) => b.bgShare - a.bgShare).filter((c) => c.bgShare > 0.01), 3);
  // Text colors: most text weight.
  take([...all].sort((a, b) => b.textShare - a.textShare).filter((c) => c.textShare > 0.01), 3);
  // Accent candidates: saturated colors on interactive elements (the key
  // signal — brand accents almost always appear on buttons/links).
  take(
    [...all]
      .filter((c) => c.interactiveCount > 0 && c.chroma > 15)
      .sort((a, b) => b.interactiveCount - a.interactiveCount),
    4
  );
  // Hero / key-visual hues: gradient backgrounds, dominant rendered pixels
  // and og:image colors. This is where "the site is obviously blue" lives
  // when the blue is a gradient or photograph.
  take(
    [...all]
      .filter((c) => c.gradShare > 0.08 && c.chroma > 8)
      .sort((a, b) => b.gradShare - a.gradShare),
    3
  );
  take(
    [...all]
      .filter((c) => c.pixelShare > 0.04 && c.chroma > 12)
      .sort((a, b) => b.pixelShare - a.pixelShare),
    3
  );
  take(
    [...all]
      .filter((c) => c.keyVisualShare > 0.08 && c.chroma > 15)
      .sort((a, b) => b.keyVisualShare - a.keyVisualShare),
    2
  );
  // Logo colors.
  take([...all].filter((c) => c.fromLogo).sort((a, b) => b.chroma - a.chroma), 3);
  // Brand-named CSS variables (naming itself is strong evidence).
  take(all.filter((c) => c.cssVarNames.some((n) => BRAND_VAR_RE.test(n))), 3);
  // Remaining saturated colors with meaningful presence, as a safety net.
  take(
    [...all]
      .filter((c) => c.chroma > 25 && (c.bgShare > 0.01 || c.textShare > 0.01))
      .sort((a, b) => b.chroma - a.chroma),
    2
  );

  return [...picked.values()].slice(0, MAX_CANDIDATES);
}

/** Compact, LLM-readable rendering of the candidate list. */
export function describeCandidates(candidates: PaletteCandidate[]): string {
  return candidates
    .map((c) => `- ${c.hex} — ${c.evidence.length ? c.evidence.join(" / ") : "補助候補"}`)
    .join("\n");
}
