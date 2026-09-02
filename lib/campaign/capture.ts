import "server-only";

import sharp from "sharp";
import type { CaptureEvidence } from "./palette";
import type { DesignTokens } from "./schema";

// Stage 1 of the Tier S palette pipeline: render the real page in headless
// Chromium and collect what a human actually sees — screenshots plus a
// computed-style color histogram weighted by on-screen area, interactive
// element colors, :root CSS variables and logo pixels.
//
// Playwright is imported dynamically: on hosts without Chromium (e.g. the
// current Vercel runtime) captureSite() returns null and the pipeline falls
// back to the static-analysis path with palette_source: "generated".

export interface SiteCapture {
  url: string;
  /** base64 JPEG screenshots for the VLM adjudicator */
  screenshots: {
    desktop: string; // 1440×900 viewport, stored as 1024×640 JPEG
    fullPage: string | null; // top of the page, downscaled
    mobile: string | null; // 390×844 above-the-fold JPEG
  };
  evidence: CaptureEvidence;
  /** header logo element screenshot (or favicon fallback), base64 PNG */
  logoImage: string | null;
  /** inline-SVG logo with computed fills baked in (vector master), when the
   *  detected logo element was an <svg> */
  logoSvg: string | null;
  /** Top scored logo picks (crop + evidence), #1 first. logoImage/logoSvg stay
   *  the deterministic #1; the runners-up exist for the VLM adjudicator. */
  logoCandidates: CapturedLogoCandidate[];
  /** best-effort design guideline hints from computed CSS */
  designTokens: DesignTokens;
}

export interface CapturedLogoCandidate {
  /** normalized PNG crop of the rendered element, base64 */
  image: string | null;
  /** inline-svg serialization (vector master) when the element was an <svg> */
  svg: string | null;
  /** referenced file URL when the element was an <img> */
  src: string | null;
  score: number;
  /** one evidence line for the adjudicator */
  note: string;
}

const NAV_TIMEOUT = 30_000;
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

type RawPageColors = {
  bg: [string, number][];
  txt: [string, number][];
  border: [string, number][];
  grad: [string, number][]; // gradient background stops, weighted by area
  inter: [string, number][]; // key: "hex|role"
  vars: { name: string; hex: string }[];
  tokens: {
    bodyFont: string | null;
    headingFont: string | null;
    buttonRadius: string | null;
    buttonPadding: string | null;
    sectionSpacing: string | null;
    containerWidth: string | null;
  };
};

// Runs inside the page. Kept as a plain-JS source string (not a function)
// so no bundler (tsx/esbuild keepNames, webpack, turbopack) can inject
// helpers like `__name` that don't exist in the browser context.
const COLLECT_PAGE_COLORS = String.raw`(() => {
  const MAX_ELEMENTS = 6000;
  const bg = new Map();
  const txt = new Map();
  const border = new Map();
  const grad = new Map();
  const inter = new Map();

  const parse = (s) => {
    if (!s) return null;
    const hexM = s.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexM) {
      let h = hexM[1].toLowerCase();
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      return "#" + h;
    }
    const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    if (m[4] !== undefined) {
      const a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (a < 0.5) return null;
    }
    const h = (n) => (+n).toString(16).padStart(2, "0");
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  };
  const add = (map, hex, w) => {
    if (hex && w > 0) map.set(hex, (map.get(hex) || 0) + w);
  };

  const vw = window.innerWidth;
  // Consider the top few viewports — where the brand actually shows.
  const scanH = Math.min(document.documentElement.scrollHeight, window.innerHeight * 5);

  let count = 0;
  for (const el of Array.from(document.querySelectorAll("*"))) {
    if (++count > MAX_ELEMENTS) break;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    if (r.width < 2 || r.height < 2 || top > scanH) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.1)
      continue;

    const area = Math.min(r.width, vw) * Math.min(r.height, scanH);
    add(bg, parse(cs.backgroundColor), area);

    // Gradient backgrounds (hero key visuals live here — invisible to the
    // backgroundColor histogram): weight each stop by the painted area.
    const bi = cs.backgroundImage;
    if (bi && bi.indexOf("gradient(") !== -1 && area > 4000) {
      const stops = bi.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b/g) || [];
      for (const s of stops.slice(0, 6)) {
        add(grad, parse(s), area / Math.max(stops.length, 1));
      }
    }

    let textLen = 0;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) textLen += (n.textContent || "").trim().length;
    }
    if (textLen > 0) {
      const fs = parseFloat(cs.fontSize) || 16;
      add(txt, parse(cs.color), textLen * fs * fs);
    }

    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw > 0) add(border, parse(cs.borderTopColor), (r.width + r.height) * 2 * bw);

    if (el instanceof SVGElement) add(bg, parse(cs.fill), area * 0.5);

    if (
      el.matches(
        'a, button, [role="button"], input[type="submit"], input[type="button"], summary'
      )
    ) {
      const b = parse(cs.backgroundColor);
      if (b) inter.set(b + "|background", (inter.get(b + "|background") || 0) + 1);
      const c = parse(cs.color);
      if (c) inter.set(c + "|text", (inter.get(c + "|text") || 0) + 1);
    }
  }

  // :root CSS custom properties that resolve to a color. Chromium exposes
  // custom properties when iterating the computed style declaration.
  const vars = [];
  try {
    const rootCs = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootCs.length && vars.length < 60; i++) {
      const name = rootCs[i];
      if (!name.startsWith("--")) continue;
      const hex = parse(rootCs.getPropertyValue(name).trim());
      if (hex) vars.push({ name, hex });
    }
  } catch (e) {
    // best effort
  }

  // Best-effort design tokens: the most common value wins.
  const mode = (xs) => {
    const m = new Map();
    for (const x of xs) if (x) m.set(x, (m.get(x) || 0) + 1);
    let best = null, n = 0;
    for (const [k, v] of m) if (v > n) { best = k; n = v; }
    return best;
  };
  // Brand font families: the leading real families of the declared stack.
  // Skips generic keywords and synthetic "<X> Fallback" faces (next/font
  // metric shims). Keeps up to two — JP sites routinely pair a Latin face
  // with a JP face (e.g. "Ubuntu, Noto Sans JP") and both matter.
  const GENERIC = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|cursive|fantasy|math|emoji|-apple-system|BlinkMacSystemFont|Segoe UI|Helvetica( Neue)?|Arial|Roboto Fallback)$/i;
  const renderedFont = (el) => {
    if (!el) return null;
    const fam = getComputedStyle(el).fontFamily || "";
    const families = fam
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((f) => f && !GENERIC.test(f) && !/ Fallback$/i.test(f));
    return families.length ? families.slice(0, 2).join(", ") : null;
  };
  const tokens = { bodyFont: null, headingFont: null, buttonRadius: null, buttonPadding: null, sectionSpacing: null, containerWidth: null };
  try {
    // Body font: measure on a real paragraph when possible (body itself is
    // often reset-styled).
    let textEl = null;
    for (const p of Array.from(document.querySelectorAll("p, li")).slice(0, 200)) {
      const t = (p.textContent || "").trim();
      const r = p.getBoundingClientRect();
      if (t.length >= 20 && r.width > 100) { textEl = p; break; }
    }
    tokens.bodyFont = renderedFont(textEl || document.body);
    tokens.headingFont = renderedFont(document.querySelector("h1, h2")) || tokens.bodyFont;

    // Button tokens: only CTA-looking elements (saturated or dark solid
    // background, button proportions). Circular icon buttons (radius 50%,
    // near-square) previously polluted this — exclude them.
    const chromaOf = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    const lumaOf = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    const radii = [], paddings = [];
    for (const el of Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]')).slice(0, 400)) {
      // CTA styling often lives on the anchor's single wrapper child, not on
      // the <a> itself — follow one level down when the anchor is unpainted.
      let cs = getComputedStyle(el);
      let bgHex = parse(cs.backgroundColor);
      if (!bgHex && el.children.length === 1) {
        const child = el.children[0];
        const ccs = getComputedStyle(child);
        const cHex = parse(ccs.backgroundColor);
        if (cHex) { cs = ccs; bgHex = cHex; }
      }
      if (!bgHex) continue;
      if (chromaOf(bgHex) < 24 && lumaOf(bgHex) > 96) continue; // not a CTA color
      const r = el.getBoundingClientRect();
      if (r.width < 72 || r.height < 30 || r.width / r.height < 1.6) continue; // icons/circles out
      const rad = cs.borderTopLeftRadius;
      if (rad && !rad.endsWith("%")) {
        // normalize pills: radius >= half height means "fully rounded"
        radii.push(parseFloat(rad) >= r.height / 2 ? "999px" : rad);
      }
      paddings.push(cs.paddingTop + " " + cs.paddingLeft);
    }
    tokens.buttonRadius = mode(radii);
    tokens.buttonPadding = mode(paddings);

    const secPads = [];
    for (const el of Array.from(document.querySelectorAll("section")).slice(0, 60)) {
      const pt = parseFloat(getComputedStyle(el).paddingTop) || 0;
      if (pt >= 24) secPads.push(Math.round(pt / 8) * 8 + "px");
    }
    tokens.sectionSpacing = mode(secPads);

    const widths = [];
    let scanned = 0;
    for (const el of Array.from(document.querySelectorAll("div, main, section")).slice(0, 800)) {
      if (++scanned > 800) break;
      const cs = getComputedStyle(el);
      if (cs.maxWidth && cs.maxWidth.endsWith("px") && parseFloat(cs.maxWidth) >= 640 && cs.marginLeft === cs.marginRight) {
        const r = el.getBoundingClientRect();
        if (r.width >= 500) widths.push(cs.maxWidth);
      }
    }
    tokens.containerWidth = mode(widths);
  } catch (e) {
    // best effort
  }

  return {
    bg: Array.from(bg.entries()),
    txt: Array.from(txt.entries()),
    border: Array.from(border.entries()),
    grad: Array.from(grad.entries()),
    inter: Array.from(inter.entries()),
    vars,
    tokens,
  };
})()`;

// Runs inside the page: score every plausible logo element and tag the best
// one for an element screenshot. The old approach took the FIRST selector
// match and gave up when it was unsuitable — on real sites that first match
// is routinely a 0x0 icon-sprite <svg>, so the actual header logo (match #3)
// was never tried. Also serializes inline-SVG logos with computed fills baked
// in: a real vector master, which is exactly this product's currency.
const PICK_LOGO_ELEMENT = String.raw`(() => {
  // Named markup: a <header>/<nav>, a "logo"/"brand" class, an alt saying so,
  // or a link to the site root. Sites built by visual builders have none of
  // these — no semantic tags, class="sd appear", empty alt — so the broad
  // selector below adds "any image inside any link", and NAMED decides how
  // much that candidate has to prove.
  const NAMED = 'header img, header svg, nav img, nav svg, [class*="logo" i] img, [class*="logo" i] svg, img[alt*="logo" i], a[href="/"] img, a[href="/"] svg';
  const SEL = NAMED + ', a img, a svg';
  const seen = new Set();
  const cands = [];
  for (const el of Array.from(document.querySelectorAll(SEL))) {
    if (seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 16 || r.height < 8 || r.width > 640 || r.height > 240) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.1) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;

    // An unnamed link image is only a logo where a logo actually sits. Without
    // this, every thumbnail in a card grid becomes a candidate and one of them
    // can out-score the real mark on position alone.
    const named = el.matches(NAMED);
    if (!named && r.top >= 200) continue;

    let hasLogoName = false, inHomeLink = false;
    let a = el, depth = 0;
    while (a && depth < 5) {
      const cls = (typeof a.className === "string" ? a.className : (a.getAttribute && a.getAttribute("class")) || "");
      const idc = (cls + " " + (a.id || "") + " " + ((a.getAttribute && a.getAttribute("alt")) || "") + " " + ((a.getAttribute && a.getAttribute("aria-label")) || "")).toLowerCase();
      if (idc.indexOf("logo") !== -1 || idc.indexOf("brand") !== -1) hasLogoName = true;
      if (a.tagName === "A") {
        // The masthead of a section links to that section, not to "/". Treat
        // the site root, this page, and any ancestor of it as "home" — all of
        // them are the link a masthead mark carries.
        let u = null;
        try { u = new URL(a.getAttribute("href") || "", location.href); } catch (e) { u = null; }
        if (u && u.origin === location.origin) {
          const there = u.pathname.replace(/\/+$/, "") || "/";
          const here = location.pathname.replace(/\/+$/, "") || "/";
          if (there === "/" || there === here || here.indexOf(there + "/") === 0) inHomeLink = true;
        }
      }
      a = a.parentElement;
      depth++;
    }

    // A vector file referenced from the masthead is a logo almost every time:
    // sites ship .svg for the mark and raster for photography.
    const rawSrc = el.tagName.toLowerCase() === "img"
      ? (el.currentSrc || el.getAttribute("src") || "")
      : "";
    const vectorFile = /\.svg(\?|#|$)/i.test(rawSrc) || rawSrc.indexOf("data:image/svg") === 0;

    let score = 0;
    if (hasLogoName) score += 3;
    if (inHomeLink) score += 3;
    if (vectorFile) score += 3;
    if (r.top < 160) score += 2;
    if (r.left < window.innerWidth * 0.4) score += 1;
    const ar = r.width / r.height;
    if (ar >= 1.6 && ar <= 12) score += 2;       // wordmark proportions
    else if (ar >= 0.8) score += 1;               // square-ish mark
    const area = r.width * r.height;
    if (area >= 600 && area <= 60000) score += 1;
    if (area < 900 && !hasLogoName) score -= 2;   // hamburger-sized icons
    if (!hasLogoName && !inHomeLink && el.closest('button, [role="button"]')) score -= 2;

    cands.push({ el, score, r, area, hasLogoName, inHomeLink, vectorFile });
  }
  cands.sort((x, y) => y.score - x.score || y.area - x.area);
  if (!cands[0] || cands[0].score < 3) return null;

  // Inline <svg> → serialize with computed fills/strokes inlined so the
  // markup survives outside the page's stylesheets.
  const serialize = (el, r) => {
    try {
      const clone = el.cloneNode(true);
      const src = [el].concat(Array.from(el.querySelectorAll("*")));
      const dst = [clone].concat(Array.from(clone.querySelectorAll("*")));
      for (let i = 0; i < src.length && i < dst.length; i++) {
        const c = getComputedStyle(src[i]);
        const d = dst[i];
        if (!d.setAttribute) continue;
        if (c.fill) d.setAttribute("fill", c.fill);
        if (c.stroke && c.stroke !== "none") {
          d.setAttribute("stroke", c.stroke);
          if (parseFloat(c.strokeWidth)) d.setAttribute("stroke-width", c.strokeWidth);
        }
        const op = parseFloat(c.opacity);
        if (op >= 0 && op < 1) d.setAttribute("opacity", String(op));
        const fo = parseFloat(c.fillOpacity);
        if (fo >= 0 && fo < 1) d.setAttribute("fill-opacity", String(fo));
        d.removeAttribute("class");
      }
      clone.removeAttribute("data-logos-pick");
      clone.setAttribute("width", String(Math.round(r.width)));
      clone.setAttribute("height", String(Math.round(r.height)));
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const out = clone.outerHTML;
      return out.length > 300000 ? null : out;
    } catch (e) {
      return null;
    }
  };

  // Top 3 distinct-looking picks, each tagged for an element screenshot. The
  // #1 heuristic pick stays the deterministic default; the runners-up exist so
  // an adjudicator can overrule a mis-scored pick (VLM, choose-only).
  for (const n of Array.from(document.querySelectorAll("[data-logos-pick]"))) n.removeAttribute("data-logos-pick");
  const picks = [];
  const usedSrc = new Set();
  for (const cand of cands) {
    if (picks.length >= 3 || cand.score < 3) break;
    const tag = cand.el.tagName.toLowerCase();
    const src = tag === "img"
      ? (cand.el.currentSrc || cand.el.getAttribute("src") || null)
      : null;
    if (src && usedSrc.has(src)) continue; // same file rendered twice
    if (src) usedSrc.add(src);
    cand.el.setAttribute("data-logos-pick", String(picks.length + 1));
    const alt = (cand.el.getAttribute && (cand.el.getAttribute("alt") || cand.el.getAttribute("aria-label"))) || "";
    const marks = [];
    if (cand.hasLogoName) marks.push("logo/brandの名前");
    if (cand.inHomeLink) marks.push("ホームへのリンク内");
    if (cand.vectorFile) marks.push("SVGファイル参照");
    const note = "実画面の<" + tag + ">" +
      (alt ? ' alt="' + alt.slice(0, 60) + '"' : "") +
      " " + Math.round(cand.r.width) + "×" + Math.round(cand.r.height) +
      "px @(" + Math.round(cand.r.left) + "," + Math.round(cand.r.top) + ")" +
      (marks.length ? " — " + marks.join("・") : "");
    picks.push({
      tag,
      score: cand.score,
      svg: tag === "svg" ? serialize(cand.el, cand.r) : null,
      src,
      note,
    });
  }
  return picks.length ? { picks } : null;
})()`;

async function toJpegBase64(png: Buffer, width: number, maxHeight = 3000): Promise<string> {
  let img = sharp(png).resize({ width, withoutEnlargement: true });
  const meta = await img.jpeg({ quality: 72 }).toBuffer({ resolveWithObject: true });
  if (meta.info.height > maxHeight) {
    img = sharp(meta.data).extract({ left: 0, top: 0, width: meta.info.width, height: maxHeight });
    return (await img.jpeg({ quality: 72 }).toBuffer()).toString("base64");
  }
  return meta.data.toString("base64");
}

/** Dominant colors of the rendered viewport, share 0..1 — this is what a
 *  human sees, including hero photography and CSS-gradient key visuals that
 *  no computed-style histogram can observe. */
async function screenPixelColors(png: Buffer): Promise<{ hex: string; share: number }[]> {
  try {
    const { data } = await sharp(png)
      .resize(240, 240, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const counts = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i] & 0xf0;
      const g = data[i + 1] & 0xf0;
      const b = data[i + 2] & 0xf0;
      counts.set(`${r},${g},${b}`, (counts.get(`${r},${g},${b}`) ?? 0) + 1);
      total++;
    }
    if (total === 0) return [];
    const h = (n: number) => (n | 8).toString(16).padStart(2, "0");
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, n]) => {
        const [r, g, b] = key.split(",").map(Number);
        return { hex: `#${h(r)}${h(g)}${h(b)}`, share: n / total };
      })
      .filter((c) => c.share >= 0.015);
  } catch {
    return [];
  }
}

/** Dominant colors of an image buffer (logo / favicon / og:image), share 0..1. */
export async function imageDominantColors(
  buf: Buffer
): Promise<{ hex: string; share: number }[]> {
  return dominantColors(buf);
}

/** Dominant colors of an image buffer (logo / favicon), share 0..1. */
async function dominantColors(buf: Buffer): Promise<{ hex: string; share: number }[]> {
  try {
    const { data } = await sharp(buf)
      .resize(48, 48, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const counts = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // transparent
      // quantize to 16 levels per channel to merge JPEG noise
      const r = data[i] & 0xf0;
      const g = data[i + 1] & 0xf0;
      const b = data[i + 2] & 0xf0;
      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
    if (total === 0) return [];
    const h = (n: number) => (n | 8).toString(16).padStart(2, "0"); // center of the bucket
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, n]) => {
        const [r, g, b] = key.split(",").map(Number);
        return { hex: `#${h(r)}${h(g)}${h(b)}`, share: n / total };
      })
      .filter((c) => c.share >= 0.02);
  } catch {
    return [];
  }
}

/** Public wrapper: normalize any decodable image (SVG included — sharp
 *  rasterizes it) to a compact base64 PNG for VLM input and previews. */
export async function normalizeLogoPng(buf: Buffer): Promise<string | null> {
  return toLogoPng(buf);
}

/** Normalize a logo/favicon image to a compact PNG (max 512px wide). */
async function toLogoPng(buf: Buffer): Promise<string | null> {
  try {
    const out = await sharp(buf)
      .resize({ width: 512, withoutEnlargement: true })
      .png()
      .toBuffer();
    return out.toString("base64");
  } catch {
    return null; // e.g. .ico favicons sharp can't decode
  }
}

function rawToEvidence(
  raw: RawPageColors,
  logoColors: { hex: string; share: number }[],
  pixels: { hex: string; share: number }[]
): CaptureEvidence {
  return {
    backgrounds: raw.bg.map(([hex, weight]) => ({ hex, weight })),
    texts: raw.txt.map(([hex, weight]) => ({ hex, weight })),
    borders: raw.border.map(([hex, weight]) => ({ hex, weight })),
    gradients: (raw.grad ?? []).map(([hex, weight]) => ({ hex, weight })),
    pixels: pixels.map((p) => ({ hex: p.hex, weight: p.share })),
    interactive: raw.inter.map(([key, count]) => {
      const [hex, role] = key.split("|") as [string, "background" | "text"];
      return { hex, role, count };
    }),
    cssVars: raw.vars,
    logoColors,
  };
}

/** page.evaluate, retried once when an in-page navigation (redirect, carousel
 *  link, meta refresh) destroys the execution context mid-run. Without this a
 *  single navigation kills the whole capture — screenshots, palette and logo. */
async function evaluateSettled<T>(
  page: import("playwright").Page,
  script: string
): Promise<T> {
  try {
    return (await page.evaluate(script)) as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Execution context was destroyed|navigation/i.test(msg)) throw e;
    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1_200);
    return (await page.evaluate(script)) as T;
  }
}

export async function captureSite(
  url: string,
  opts: { faviconUrl?: string | null } = {}
): Promise<SiteCapture | null> {
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    return null; // playwright not installed on this host
  }

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await pw.chromium.launch({ headless: true });

    // --- desktop pass: evidence + screenshots ---
    const context = await browser.newContext({
      viewport: DESKTOP,
      locale: "ja-JP",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    } catch {
      // networkidle never settles on some sites; take what has loaded
    }
    await page.waitForTimeout(1200);

    const raw = await evaluateSettled<RawPageColors>(page, COLLECT_PAGE_COLORS);

    const desktopPng = await page.screenshot({ type: "png" });
    const desktopShot = await toJpegBase64(desktopPng, 1024);
    // What a human actually sees above the fold — catches hero photography
    // and gradient key visuals invisible to the computed-style histogram.
    const pixels = await screenPixelColors(desktopPng);

    let fullPage: string | null = null;
    try {
      const scrollHeight = (await page.evaluate(
        "document.documentElement.scrollHeight"
      )) as number;
      const clipH = Math.min(scrollHeight, 4500);
      const fullPng = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: DESKTOP.width, height: clipH },
      });
      fullPage = await toJpegBase64(fullPng, 640, 2600);
    } catch {
      fullPage = null;
    }

    // Logo: score all candidates in-page, screenshot the top picks, and keep
    // the inline-SVG vector when a logo element is an <svg>.
    let logoColors: { hex: string; share: number }[] = [];
    let logoImage: string | null = null;
    let logoSvg: string | null = null;
    const logoCandidates: CapturedLogoCandidate[] = [];
    try {
      const picked = await evaluateSettled<{
        picks: {
          tag: string;
          score: number;
          svg: string | null;
          src: string | null;
          note: string;
        }[];
      } | null>(page, PICK_LOGO_ELEMENT);
      const picks = picked?.picks ?? [];
      const primary = picks[0] ?? null;
      if (primary) {
        logoSvg = primary.svg;

        // <img src="…"> logo: fetch the referenced file through the page's
        // browser context. An .svg file is the vector master (same value as
        // an inline <svg>); any raster file at natural resolution beats the
        // rendered-size element screenshot below.
        if (!logoSvg && primary.src) {
          try {
            const abs = new URL(primary.src, page.url()).href;
            const resp = await page.request.get(abs, { timeout: 10_000 });
            if (resp.ok()) {
              const body = await resp.body();
              const ct = resp.headers()["content-type"] ?? "";
              const isSvg =
                ct.includes("svg") ||
                new URL(abs).pathname.toLowerCase().endsWith(".svg");
              if (isSvg && body.length < 300_000) {
                // Scripts are inert in the <img data:> contexts we embed
                // into, but strip them anyway.
                logoSvg = body
                  .toString("utf8")
                  .replace(/<script[\s\S]*?<\/script>/gi, "");
              } else if (!isSvg && body.length < 3_000_000) {
                try {
                  logoImage = await toLogoPng(body);
                  logoColors = await dominantColors(body);
                } catch {
                  // not a decodable raster — fall back to the screenshot
                }
              }
            }
          } catch {
            // fetch failed — the element screenshot below still works
          }
        }

        for (let i = 0; i < picks.length; i++) {
          const el = page.locator(`[data-logos-pick="${i + 1}"]`).first();
          let crop: string | null = null;
          try {
            const png = await el.screenshot({ type: "png" });
            crop = await toLogoPng(png);
            if (i === 0) {
              if (logoColors.length === 0) logoColors = await dominantColors(png);
              if (!logoImage) logoImage = crop;
            }
          } catch {
            // element gone or zero-sized — keep the candidate without a crop
          }
          logoCandidates.push({
            image: crop,
            svg: picks[i].svg,
            src: picks[i].src,
            score: picks[i].score,
            note: picks[i].note,
          });
        }
      }
    } catch {
      // logo detection is best-effort
    }
    if ((logoColors.length === 0 || !logoImage) && opts.faviconUrl) {
      try {
        const res = await fetch(opts.faviconUrl, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (logoColors.length === 0) logoColors = await dominantColors(buf);
          if (!logoImage) logoImage = await toLogoPng(buf);
        }
      } catch {
        // ignore
      }
    }

    await context.close();

    // --- mobile pass: screenshot only ---
    let mobile: string | null = null;
    try {
      const mctx = await browser.newContext({
        viewport: MOBILE,
        locale: "ja-JP",
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });
      const mpage = await mctx.newPage();
      try {
        await mpage.goto(url, { waitUntil: "networkidle", timeout: 20_000 });
      } catch {
        // best effort
      }
      await mpage.waitForTimeout(800);
      mobile = await toJpegBase64(await mpage.screenshot({ type: "png" }), 480);
      await mctx.close();
    } catch {
      mobile = null;
    }

    return {
      url,
      screenshots: { desktop: desktopShot, fullPage, mobile },
      evidence: rawToEvidence(raw, logoColors, pixels),
      logoImage,
      logoSvg,
      logoCandidates,
      designTokens: {
        body_font: raw.tokens?.bodyFont ?? null,
        heading_font: raw.tokens?.headingFont ?? null,
        button_radius: raw.tokens?.buttonRadius ?? null,
        button_padding: raw.tokens?.buttonPadding ?? null,
        section_spacing: raw.tokens?.sectionSpacing ?? null,
        container_width: raw.tokens?.containerWidth ?? null,
      },
    };
  } catch (e) {
    console.error("captureSite failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Screenshot self-contained HTML (the generated LP) for the verification loop. */
export async function screenshotHtml(html: string): Promise<string | null> {
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    return null;
  }
  let browser: import("playwright").Browser | null = null;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: DESKTOP });
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    await page.waitForTimeout(400);
    return await toJpegBase64(await page.screenshot({ type: "png" }), 1024);
  } catch (e) {
    console.error("screenshotHtml failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
