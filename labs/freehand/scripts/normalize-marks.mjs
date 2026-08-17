// Trim marks, then match them by optical weight rather than by height.
//
// Two separate problems, both of which a designer solves by eye in seconds and
// neither of which a renderer can solve without measuring:
//
//   1. MARGIN. Supplied artwork carries whatever transparent padding the person
//      who exported it happened to leave. Miss SAKE's file has more than
//      Leopalace's. Aligning two such files by their FILE box aligns their
//      padding, not their marks.
//
//   2. WEIGHT. Even perfectly trimmed, a two-line lockup (Miss SAKE: script
//      "Miss" over blocky "SAKE") set to the same height as a one-line wordmark
//      (Leopalace 21) has letters half the size — it reads as the junior
//      partner. Designers match the INK, not the box.
//
// So: trim to the alpha bounding box, measure how much ink the mark actually
// has at unit height, and emit a per-mark scale that equalises it. Ink area
// grows with the square of height, so the correction is a square root —
// damped, because full area-matching turns a thin calligraphic mark into a
// giant (〆張鶴 is 5% ink where a solid wordmark is 30%).
//
// Deterministic: no model, no judgement, same numbers every run. The result is
// a committed manifest (src/freehand/marks.json) plus trimmed PNGs, so the
// renderer reads a number instead of guessing.
//
// Run from the repository root (sharp lives there):
//   node labs/freehand/scripts/normalize-marks.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "public/event/sake-2026/logos");
const OUT_DIR = path.join(ROOT, "labs/freehand/sake-2026/public/assets/mark");
const MANIFEST = path.join(ROOT, "labs/freehand/sake-2026/src/freehand/marks.json");

/** Alpha below this is padding, not artwork. */
const ALPHA_FLOOR = 12;
/** Height every trimmed mark is rasterised to before measuring. */
const MEASURE_HEIGHT = 400;
/**
 * How hard to correct toward equal ink.
 *
 * 1.0 = equal ink area (a hairline mark becomes enormous), 0 = equal height
 * (a two-line lockup disappears). 0.5 is the halfway house that looked right
 * on this row of four and is the number to argue with when it doesn't.
 */
const CORRECTION = 0.5;
/** Nothing may end up more than this much bigger or smaller than the row. */
const SCALE_RANGE = [0.78, 1.5];
/** A very wide wordmark still may not eat the row. */
const MAX_WIDTH_RATIO = 4.6;

const MARKS = [
  { name: "wealthpark-lab", file: "wealthpark-lab.svg", ink: "dark" },
  { name: "leopalace21", file: "leopalace21.png", ink: "light" },
  { name: "shimeharitsuru", file: "shimeharitsuru.png", ink: "light" },
  { name: "miss-sake", file: "miss-sake.png", ink: "light" },
];

/** The alpha bounding box: the smallest rectangle holding actual artwork. */
async function alphaBounds(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha <= ALPHA_FLOOR) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) throw new Error("mark is entirely transparent");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Alpha-weighted coverage: what share of the trimmed box is actually ink. */
async function inkRatio(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize({ height: MEASURE_HEIGHT })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 3; i < data.length; i += info.channels) sum += data[i];
  return sum / 255 / (info.width * info.height);
}

mkdirSync(OUT_DIR, { recursive: true });

const measured = [];
for (const mark of MARKS) {
  const source = path.join(SOURCE_DIR, mark.file);
  // SVG has no pixels until something asks for them; density gives the
  // rasteriser enough resolution that the trim is not quantised.
  const raster = await sharp(source, { density: 600 })
    .resize({ height: MEASURE_HEIGHT * 2, fit: "inside" })
    .png()
    .toBuffer();
  const box = await alphaBounds(raster);
  const trimmed = await sharp(raster).extract(box).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const aspect = meta.width / meta.height;
  const ratio = await inkRatio(trimmed);
  measured.push({ ...mark, trimmed, aspect, ratio, padding: box });
}

// Ink area at unit height is coverage × aspect. The reference is the median so
// that one outlier mark cannot drag the whole row with it.
const areas = measured.map((m) => m.ratio * m.aspect);
const reference = [...areas].sort((a, b) => a - b)[Math.floor(areas.length / 2)];

const manifest = {};
for (const mark of measured) {
  const area = mark.ratio * mark.aspect;
  const raw = Math.pow(reference / area, CORRECTION / 2);
  let scale = Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], raw));
  // A wordmark whose corrected width would still run away gets pulled back.
  if (mark.aspect * scale > MAX_WIDTH_RATIO) scale = MAX_WIDTH_RATIO / mark.aspect;

  const out = `${mark.name}_trimmed.png`;
  await sharp(mark.trimmed).toFile(path.join(OUT_DIR, out));
  manifest[mark.name] = {
    src: `assets/mark/${out}`,
    ink: mark.ink,
    aspect: Number(mark.aspect.toFixed(4)),
    inkRatio: Number(mark.ratio.toFixed(4)),
    scale: Number(scale.toFixed(3)),
  };
  console.log(
    `${mark.name.padEnd(16)} aspect ${mark.aspect.toFixed(2).padStart(5)}  ` +
      `ink ${(mark.ratio * 100).toFixed(1).padStart(5)}%  ` +
      `area ${area.toFixed(3)}  → scale ${scale.toFixed(3)}`,
  );
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${MANIFEST}`);
