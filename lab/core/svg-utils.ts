// Logo preprocessing for the lab.
//
// SVG analysis reuses the production pipeline (lib/svg.ts) so that whatever
// works here works identically when ported back into the product. On top of
// that we add lab-specific helpers: mounting a baked SVG into an experiment
// canvas, enumerating its drawable shapes, and a lightweight PNG palette
// extractor for raster logos.

import { analyzeSvg } from "@/lib/svg";
import { hexToRgb, rgbToCmyk, rgbToHex } from "@/lib/color";
import type { BrandColor } from "@/lib/svg";
import type { LabLogo } from "./experiment-api";

const SHAPE_SELECTOR =
  "path, rect, circle, ellipse, polygon, polyline, line, text";

/** Analyze an SVG source string into a LabLogo. Browser only. Throws on bad input. */
export function prepareSvgLogo(
  source: string,
  name: string,
  id: string,
  builtin = false,
): LabLogo {
  const data = analyzeSvg(source, name);
  const doc = new DOMParser().parseFromString(data.svg, "image/svg+xml");
  const shapeCount = doc.querySelectorAll(SHAPE_SELECTOR).length;
  return {
    id,
    name,
    kind: "svg",
    builtin,
    svg: data.svg,
    viewBox: data.viewBox,
    colors: data.colors,
    shapeCount,
  };
}

/** Analyze a PNG data URI: natural size + a rough area-weighted palette. */
export function preparePngLogo(
  dataUri: string,
  name: string,
  id: string,
): Promise<LabLogo> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error("This PNG has no drawable area."));
        return;
      }
      resolve({
        id,
        name,
        kind: "png",
        pngDataUri: dataUri,
        viewBox: { x: 0, y: 0, w, h },
        colors: extractPngPalette(img),
        shapeCount: 0,
      });
    };
    img.onerror = () => reject(new Error("This file could not be read as PNG."));
    img.src = dataUri;
  });
}

/** Downsample to a small canvas and bucket opaque pixels into a palette. */
function extractPngPalette(img: HTMLImageElement): BrandColor[] {
  const SIZE = 64;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return [];
  }

  // Quantize to 4 bits per channel to merge near-identical colors.
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let opaque = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;
    opaque++;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n++;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }
  if (!opaque) return [];

  return Array.from(buckets.values())
    .filter((b) => b.n / opaque >= 0.02)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((b) => {
      const rgb = {
        r: Math.round(b.r / b.n),
        g: Math.round(b.g / b.n),
        b: Math.round(b.b / b.n),
      };
      const hex = rgbToHex(rgb);
      return {
        hex,
        rgb: hexToRgb(hex),
        cmyk: rgbToCmyk(rgb),
        share: b.n / opaque,
      };
    });
}

export type MountedLogo = {
  svg: SVGSVGElement;
  /** Drawable shapes in document order, ready for per-shape animation. */
  shapes: SVGGraphicsElement[];
};

/**
 * Mount baked SVG markup into a host element and return the live element
 * plus its drawable shapes. The SVG fills the host (contain fit); the caller
 * controls sizing/clear space through the host's box.
 */
export function mountLogoSvg(host: HTMLElement, svgMarkup: string): MountedLogo {
  host.innerHTML = svgMarkup;
  const svg = host.querySelector("svg");
  if (!svg) throw new Error("mountLogoSvg: markup did not contain an <svg>.");
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.display = "block";
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const shapes = Array.from(
    svg.querySelectorAll<SVGGraphicsElement>(SHAPE_SELECTOR),
  );
  return { svg, shapes };
}

/**
 * Render a logo (SVG or PNG) into a host as static, centered, contain-fit
 * content — no shape enumeration. For experiments that animate the whole mark
 * as one unit (mask/blur/scale on the container), which also gives them PNG
 * support for free.
 */
export function mountLogo(host: HTMLElement, logo: LabLogo): void {
  if (logo.kind === "png" && logo.pngDataUri) {
    host.innerHTML = "";
    const img = document.createElement("img");
    img.src = logo.pngDataUri;
    img.alt = logo.name;
    img.style.cssText =
      "width:100%;height:100%;object-fit:contain;display:block";
    host.appendChild(img);
    return;
  }
  if (logo.svg) {
    host.innerHTML = logo.svg;
    const svg = host.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  }
}

/** A logo as a single data URI (SVG source or PNG), usable as a CSS mask or image src. */
export function logoDataUri(logo: LabLogo): string {
  if (logo.kind === "png" && logo.pngDataUri) return logo.pngDataUri;
  return `data:image/svg+xml,${encodeURIComponent(logo.svg ?? "")}`;
}

/** Load a logo as a decoded HTMLImageElement (for canvas rasterization/sampling). */
export function logoToImage(logo: LabLogo): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the logo image."));
    img.src = logoDataUri(logo);
  });
}

/** getTotalLength that never throws (text and some degenerate shapes lack it). */
export function safeTotalLength(el: SVGGraphicsElement): number {
  const geo = el as SVGGeometryElement;
  if (typeof geo.getTotalLength !== "function") return 0;
  try {
    return geo.getTotalLength();
  } catch {
    return 0;
  }
}
