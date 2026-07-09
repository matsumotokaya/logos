// Client-side SVG analysis pipeline.
// Everything here must run in the browser (DOMParser, getComputedStyle, getBBox).

import { normalizeColor, hexToRgb, rgbToCmyk, type RGB } from "./color";
import { parsePathD, type Pt, type Handle } from "./paths";

export type ViewBox = { x: number; y: number; w: number; h: number };

export type BrandColor = {
  hex: string;
  rgb: RGB;
  cmyk: [number, number, number, number];
  share: number; // 0..1, approximate visual weight
};

export type LogoData = {
  /** Baked master SVG: viewBox normalized, computed fills/strokes written as attributes. */
  svg: string;
  viewBox: ViewBox;
  colors: BrandColor[];
  anchors: Pt[];
  handles: Handle[];
  fileName?: string;
};

const SHAPE_SELECTOR =
  "path, rect, circle, ellipse, polygon, polyline, line, text";

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function matrixApply(m: DOMMatrix, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** Parse, normalize and analyze an SVG source string. Throws with a user-facing message. */
export function analyzeSvg(source: string, fileName?: string): LogoData {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("This file could not be parsed as SVG.");
  }

  // Safety: strip active content before mounting.
  doc.querySelectorAll("script, foreignObject").forEach((el) => el.remove());
  Array.from(doc.documentElement.attributes).forEach((attr) => {
    if (attr.name.startsWith("on")) doc.documentElement.removeAttribute(attr.name);
  });

  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:800px;overflow:hidden;pointer-events:none";
  host.appendChild(document.importNode(doc.documentElement, true));
  document.body.appendChild(host);

  try {
    const live = host.firstElementChild as SVGSVGElement;
    live.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // --- viewBox normalization ---
    let vb: ViewBox;
    const vbAttr = live.viewBox?.baseVal;
    if (vbAttr && (vbAttr.width > 0 || vbAttr.height > 0)) {
      vb = { x: vbAttr.x, y: vbAttr.y, w: vbAttr.width, h: vbAttr.height };
    } else {
      const wAttr = parseFloat(live.getAttribute("width") || "");
      const hAttr = parseFloat(live.getAttribute("height") || "");
      if (wAttr > 0 && hAttr > 0) {
        vb = { x: 0, y: 0, w: wAttr, h: hAttr };
      } else {
        const bb = live.getBBox();
        const pad = Math.max(bb.width, bb.height) * 0.05 || 10;
        vb = { x: bb.x - pad, y: bb.y - pad, w: bb.width + pad * 2, h: bb.height + pad * 2 };
      }
    }
    if (vb.w <= 0 || vb.h <= 0) throw new Error("This SVG has no drawable area.");
    live.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    live.removeAttribute("width");
    live.removeAttribute("height");
    live.style.width = "800px";
    live.style.height = "800px";

    // --- bake computed paint into attributes, accumulate color weights ---
    const areas = new Map<string, number>();
    const addColor = (hex: string | null, area: number) => {
      if (!hex || area <= 0) return;
      areas.set(hex, (areas.get(hex) || 0) + area);
    };
    const resolveGradientStops = (ref: string): string[] => {
      const idMatch = ref.match(/url\(["']?#([^"')]+)["']?\)/);
      if (!idMatch) return [];
      const grad = live.querySelector(`[id="${CSS.escape(idMatch[1])}"]`);
      if (!grad) return [];
      return Array.from(grad.querySelectorAll("stop"))
        .map((s) => normalizeColor(getComputedStyle(s).stopColor))
        .filter((c): c is string => !!c);
    };

    const shapes = Array.from(live.querySelectorAll(SHAPE_SELECTOR));
    for (const el of shapes) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || parseFloat(cs.opacity) < 0.05) {
        el.remove();
        continue;
      }
      let area = 0;
      try {
        const bb = (el as SVGGraphicsElement).getBBox();
        area = Math.max(bb.width * bb.height, 1);
      } catch {
        area = 1;
      }

      // fill
      const fill = cs.fill;
      const fillOpacity = parseFloat(cs.fillOpacity || "1");
      if (fill.startsWith("url(")) {
        const m = fill.match(/url\(["']?(#[^"')]+)["']?\)/);
        el.setAttribute("fill", m ? `url(${m[1]})` : "none");
        const stops = resolveGradientStops(fill);
        stops.forEach((hex) => addColor(hex, area / Math.max(stops.length, 1)));
      } else if (fill === "none" || fillOpacity < 0.05) {
        el.setAttribute("fill", "none");
      } else {
        const hex = normalizeColor(fill);
        el.setAttribute("fill", hex || "none");
        addColor(hex, area);
      }

      // stroke
      const stroke = cs.stroke;
      const strokeW = parseFloat(cs.strokeWidth || "0");
      if (stroke && stroke !== "none" && strokeW > 0) {
        const hex = normalizeColor(stroke);
        if (hex) {
          el.setAttribute("stroke", hex);
          el.setAttribute("stroke-width", String(strokeW));
          try {
            const bb = (el as SVGGraphicsElement).getBBox();
            addColor(hex, 2 * (bb.width + bb.height) * strokeW);
          } catch {
            addColor(hex, strokeW);
          }
        }
      } else {
        el.removeAttribute("stroke");
      }
      el.removeAttribute("class");
      el.removeAttribute("style");
    }
    // Styles are now baked into attributes.
    live.querySelectorAll("style").forEach((el) => el.remove());

    // --- extract bezier skeleton (viewBox coordinate space) ---
    const anchors: Pt[] = [];
    const handles: Handle[] = [];
    const rootCTM = live.getScreenCTM();
    if (rootCTM) {
      const inv = rootCTM.inverse();
      const scaleX = 800 / vb.w; // live element is laid out at 800x800 via CSS
      void scaleX;
      for (const el of Array.from(live.querySelectorAll("path"))) {
        const d = el.getAttribute("d");
        const ctm = (el as SVGGraphicsElement).getScreenCTM();
        if (!d || !ctm) continue;
        const m = inv.multiply(ctm);
        const sk = parsePathD(d);
        sk.anchors.forEach((p) => anchors.push(matrixApply(m, p)));
        sk.handles.forEach((h) =>
          handles.push({ a: matrixApply(m, h.a), c: matrixApply(m, h.c) })
        );
      }
    }

    live.style.width = "";
    live.style.height = "";
    const baked = new XMLSerializer().serializeToString(live);

    const total = Array.from(areas.values()).reduce((s, v) => s + v, 0) || 1;
    const colors: BrandColor[] = Array.from(areas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hex, area]) => ({
        hex,
        rgb: hexToRgb(hex),
        cmyk: rgbToCmyk(hexToRgb(hex)),
        share: area / total,
      }));
    if (colors.length === 0) {
      throw new Error("No visible shapes were found in this SVG.");
    }

    return { svg: baked, viewBox: vb, colors, anchors, handles, fileName };
  } finally {
    host.remove();
  }
}

/** Repaint every visible shape of a baked SVG with a single color. */
export function recolorSvg(bakedSvg: string, color: string): string {
  const doc = new DOMParser().parseFromString(bakedSvg, "image/svg+xml");
  doc.querySelectorAll(SHAPE_SELECTOR).forEach((el) => {
    const fill = el.getAttribute("fill");
    if (fill && fill !== "none") el.setAttribute("fill", color);
    const stroke = el.getAttribute("stroke");
    if (stroke && stroke !== "none") el.setAttribute("stroke", color);
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}

/** Turn a baked SVG into a thin outline drawing (for the construction scene). */
export function outlineSvg(bakedSvg: string, strokeColor: string): string {
  const doc = new DOMParser().parseFromString(bakedSvg, "image/svg+xml");
  doc.querySelectorAll(SHAPE_SELECTOR).forEach((el) => {
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", strokeColor);
    el.setAttribute("stroke-width", "1");
    el.setAttribute("vector-effect", "non-scaling-stroke");
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}
