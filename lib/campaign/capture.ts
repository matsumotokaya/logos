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
    desktop: string; // 1440px above-the-fold
    fullPage: string | null; // top of the page, downscaled
    mobile: string | null; // 390px above-the-fold
  };
  evidence: CaptureEvidence;
  /** header logo element screenshot (or favicon fallback), base64 PNG */
  logoImage: string | null;
  /** best-effort design guideline hints from computed CSS */
  designTokens: DesignTokens;
}

const NAV_TIMEOUT = 30_000;
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

type RawPageColors = {
  bg: [string, number][];
  txt: [string, number][];
  border: [string, number][];
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
  const firstFont = (v) => (v ? v.split(",")[0].trim().replace(/^["']|["']$/g, "") : null);
  const tokens = { bodyFont: null, headingFont: null, buttonRadius: null, buttonPadding: null, sectionSpacing: null, containerWidth: null };
  try {
    tokens.bodyFont = firstFont(getComputedStyle(document.body).fontFamily);
    const h = document.querySelector("h1, h2");
    if (h) tokens.headingFont = firstFont(getComputedStyle(h).fontFamily);

    const radii = [], paddings = [];
    for (const el of Array.from(document.querySelectorAll('button, a, [role="button"]')).slice(0, 200)) {
      const cs = getComputedStyle(el);
      if (!parse(cs.backgroundColor)) continue; // only real button-like elements
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 24) continue;
      radii.push(cs.borderTopLeftRadius);
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
    inter: Array.from(inter.entries()),
    vars,
    tokens,
  };
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

function rawToEvidence(raw: RawPageColors, logoColors: { hex: string; share: number }[]): CaptureEvidence {
  return {
    backgrounds: raw.bg.map(([hex, weight]) => ({ hex, weight })),
    texts: raw.txt.map(([hex, weight]) => ({ hex, weight })),
    borders: raw.border.map(([hex, weight]) => ({ hex, weight })),
    interactive: raw.inter.map(([key, count]) => {
      const [hex, role] = key.split("|") as [string, "background" | "text"];
      return { hex, role, count };
    }),
    cssVars: raw.vars,
    logoColors,
  };
}

const LOGO_SELECTOR = [
  "header img",
  "header svg",
  "nav img",
  "nav svg",
  '[class*="logo" i] img',
  '[class*="logo" i] svg',
  'img[alt*="logo" i]',
].join(", ");

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

    const raw = (await page.evaluate(COLLECT_PAGE_COLORS)) as RawPageColors;

    const desktopShot = await toJpegBase64(await page.screenshot({ type: "png" }), 1024);

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

    // logo element screenshot → the logo asset itself + its dominant colors
    let logoColors: { hex: string; share: number }[] = [];
    let logoImage: string | null = null;
    try {
      const logoEl = page.locator(LOGO_SELECTOR).first();
      if ((await logoEl.count()) > 0) {
        const box = await logoEl.boundingBox();
        if (box && box.width >= 16 && box.height >= 10 && box.width <= 800) {
          const png = await logoEl.screenshot({ type: "png" });
          logoColors = await dominantColors(png);
          logoImage = await toLogoPng(png);
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
      evidence: rawToEvidence(raw, logoColors),
      logoImage,
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
