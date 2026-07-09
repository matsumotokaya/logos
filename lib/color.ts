export type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const p = (v: number) => v.toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

/** Normalize any CSS color string ("rgb(...)", "#abc", "royalblue") to #RRGGBB. Client only. */
export function normalizeColor(input: string): string | null {
  const m = input.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return rgbToHex({ r: +m[1], g: +m[2], b: +m[3] });
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(input.trim())) {
    return rgbToHex(hexToRgb(input.trim()));
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000000";
  ctx.fillStyle = input;
  const v = ctx.fillStyle;
  if (typeof v === "string" && v.startsWith("#")) return v.toUpperCase();
  const m2 = String(v).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m2 ? rgbToHex({ r: +m2[1], g: +m2[2], b: +m2[3] }) : null;
}

export function rgbToCmyk({ r, g, b }: RGB): [number, number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const k = 1 - Math.max(rf, gf, bf);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - rf - k) / (1 - k);
  const m = (1 - gf - k) / (1 - k);
  const y = (1 - bf - k) / (1 - k);
  return [
    Math.round(c * 100),
    Math.round(m * 100),
    Math.round(y * 100),
    Math.round(k * 100),
  ];
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.35;
}

/** Readable text color for a given background. */
export function textOn(hex: string): string {
  return isDark(hex) ? "#F1F3F4" : "#0A0A0A";
}

/** Darken a hex color by a factor (0..1). */
export function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - factor;
  return rgbToHex({
    r: Math.round(r * f),
    g: Math.round(g * f),
    b: Math.round(b * f),
  });
}
