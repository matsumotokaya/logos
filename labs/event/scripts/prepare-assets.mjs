// Deterministic asset preparation for an event promo's material folder.
//
// Raw client material is never render-ready: stock photos arrive at 10k+ px,
// portraits are landscape JPEGs, and logos come as whatever the partner had
// (opaque JPEG, black-only SVG, white-on-transparent PNG). This script turns a
// drop folder into public/event/<slug>/ with everything sized and, for logos
// bound for a dark canvas, knocked out to a light-on-transparent variant.
//
// No LLM involved and no judgement calls: same input, same output. This is the
// deterministic prep stage that sits in front of the video renderer, the same
// split slide-factory draws between extraction (mechanical) and structuring.
//
// Usage:
//   node labs/event/scripts/prepare-assets.mjs --src <dir> --slug sake-2026

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const readFlag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const src = readFlag("--src");
const slug = readFlag("--slug");
if (!src || !slug) {
  console.error("usage: prepare-assets.mjs --src <dir> --slug <event-slug>");
  process.exit(1);
}

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "event", slug);
for (const sub of ["logos", "photos", "art"]) {
  fs.mkdirSync(path.join(OUT, sub), { recursive: true });
}

/** Longest edge a full-bleed scene photo is downscaled to. 2560 keeps a
 *  1920-wide frame sharp through a Ken Burns zoom without shipping 10k px. */
const PHOTO_MAX = 2560;
const PORTRAIT_MAX = 1200;

const log = (label, from, to) =>
  console.log(`${label.padEnd(10)} ${path.basename(from)} -> ${path.relative(ROOT, to)}`);

async function copyResized(from, to, max, quality = 84) {
  await sharp(from)
    .rotate() // honour EXIF orientation before we lose the metadata
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(to);
  log("photo", from, to);
}

/**
 * Knock a light background out of a dark-on-light logo/artwork and re-tint the
 * remaining ink to `color`, producing a light-on-transparent PNG that sits
 * directly on the ink canvas — no white plate, no runtime filter chain.
 *
 * alpha = (255 - luminance) * gain, so pure white drops out entirely while the
 * ink goes fully opaque; mid-tones (a logo's second colour, a brush's dry
 * edge) stay partly transparent, which reads as intended shading.
 */
async function knockout(from, to, { color = { r: 244, g: 239, b: 228 }, gain = 1.6, max } = {}) {
  let pipeline = sharp(from).rotate();
  if (max) pipeline = pipeline.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  // alpha = (255 - luminance) * gain, expressed as ONE linear transform.
  // Not `.negate().linear(gain, 0)`: sharp applies its colour operations in a
  // fixed internal order (linear before negate), so chaining them silently
  // computes (L * gain) negated instead — which left a mid-luminance logo at
  // ~60% alpha and washed out grey on the ink canvas.
  const { data, info } = await pipeline
    .greyscale()
    .linear(-gain, 255 * gain)
    .raw()
    .toBuffer({ resolveWithObject: true });

  await sharp({
    create: { width: info.width, height: info.height, channels: 3, background: color },
  })
    .joinChannel(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(to);
  log("knockout", from, to);
}

async function copyAsIs(from, to) {
  fs.copyFileSync(from, to);
  log("copy", from, to);
}

/** Downloaded originals are cached outside public/ so only prepared assets
 *  ever get served, and a re-run stays offline. */
const CACHE = path.join(ROOT, "var", "event-assets", slug);

/**
 * Download a partner logo the client explicitly cleared for use, recording the
 * URL here so the asset's provenance lives in the repo rather than in a chat
 * log. Returns the cached local path.
 */
async function fetchOriginal(url, name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const to = path.join(CACHE, name);
  if (fs.existsSync(to)) {
    console.log(`${"cached".padEnd(10)} ${path.relative(ROOT, to)}`);
    return to;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  log("fetched", url, to);
  return to;
}

/**
 * Turn a "knockout plate" logo — an opaque light rectangle with the logo cut
 * out as transparency — into light-on-transparent ink, then trim the plate's
 * generous margin away.
 *
 * Partners hand these out for placing over photography, but composited onto a
 * dark canvas the plate reads as a white box with the logo punched through it.
 * Inverting the alpha channel recovers the mark itself; the RGB is replaced
 * wholesale because a plate's own colour says nothing about the ink's.
 */
async function alphaInvert(from, to, { color = { r: 244, g: 239, b: 228 }, pad = 2 } = {}) {
  const { width, height } = await sharp(from).metadata();
  const alpha = await sharp(from).ensureAlpha().extractChannel("alpha").negate().raw().toBuffer();

  const tinted = await sharp({ create: { width, height, channels: 3, background: color } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  // Crop to the ink itself. sharp's .trim() compares colour and ignores a
  // pure-alpha difference, and here every pixel shares one RGB value — so the
  // bounding box is measured off the alpha channel directly.
  const box = alphaBoundingBox(alpha, width, height, pad);
  await sharp(tinted).extract(box).png({ compressionLevel: 9 }).toFile(to);
  log("alpha-inv", from, to);
}

/** Tightest rectangle containing any non-transparent pixel, grown by `pad`. */
function alphaBoundingBox(alpha, width, height, pad) {
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) throw new Error("alphaInvert: nothing opaque after inverting alpha");
  const l = Math.max(0, left - pad);
  const t = Math.max(0, top - pad);
  return {
    left: l,
    top: t,
    width: Math.min(width, right + pad + 1) - l,
    height: Math.min(height, bottom + pad + 1) - t,
  };
}

// ---------------------------------------------------------------------------
// The sake-2026 material map. Adding an event means adding a map here; the
// operations above are generic.
// ---------------------------------------------------------------------------

const MAPS = {
  "sake-2026": async () => {
    const s = (...p) => path.join(src, ...p);
    const o = (...p) => path.join(OUT, ...p);

    // --- portraits: faces are off-centre in these landscape frames, so the
    // brief carries a focus point rather than this script cropping blind.
    await copyResized(s("miyao.jpg"), o("photos", "miyao.jpg"), PORTRAIT_MAX);
    await copyResized(s("onishi.jpg"), o("photos", "onishi.jpg"), PORTRAIT_MAX);
    await copyResized(s("kato.jpg"), o("photos", "kato.jpg"), PORTRAIT_MAX);

    // --- scene photography (Adobe Stock)
    await copyResized(s("sake", "AdobeStock_1894358160.jpeg"), o("photos", "pour-lanterns.jpg"), PHOTO_MAX);
    await copyResized(s("sake", "AdobeStock_473760969.jpeg"), o("photos", "brewer.jpg"), PHOTO_MAX);
    await copyResized(s("sake", "AdobeStock_122637388.jpeg"), o("photos", "masu.jpg"), PHOTO_MAX);
    await copyResized(s("sake", "AdobeStock_292524203.jpeg"), o("photos", "kyoto-autumn.jpg"), PHOTO_MAX);
    await copyResized(s("sake", "AdobeStock_2078450052.jpeg"), o("photos", "slate.jpg"), PHOTO_MAX);

    // --- ink artwork: black on white -> light on transparent, so it can be
    // laid over the canvas as a watermark at any opacity.
    await knockout(s("sake", "AdobeStock_96941827.jpeg"), o("art", "sake-kanji.png"), { max: 2200 });
    await knockout(s("sake", "AdobeStock_2004753626.jpeg"), o("art", "brush-stroke.png"), { max: 2600 });

    // --- logos
    // 〆張鶴 and Miss SAKE come from the partners' own sites, which the client
    // cleared for use ("ロゴや画像は自由に使ってください").
    // 〆張鶴's seal is already white-on-transparent: straight copy.
    await copyAsIs(
      await fetchOriginal(
        "https://www.shimeharitsuru.co.jp/assets/img/ft_logo.png",
        "shimeharitsuru.png"
      ),
      o("logos", "shimeharitsuru.png")
    );
    // Miss SAKE's is a knockout plate (opaque white with the mark cut out).
    await alphaInvert(
      await fetchOriginal(
        "https://www.misssake.org/wp-content/uploads/2018/07/Miss-sake-01-e1531448024473.png",
        "miss-sake.png"
      ),
      o("logos", "miss-sake.png")
    );
    // Blue-on-white JPEG: knock out the white plate.
    await knockout(s("leopalace21.jpg"), o("logos", "leopalace21.png"), { gain: 1.9 });
    // Single-colour black SVG: kept vector, inverted at render time.
    await copyAsIs(s("wealthpark-lab.svg"), o("logos", "wealthpark-lab.svg"));

    await copyAsIs(s("bgm.mp3"), o("bgm.mp3"));
  },
};

const map = MAPS[slug];
if (!map) {
  console.error(`no material map for slug "${slug}" — add one in this script`);
  process.exit(1);
}
await map();
console.log(`\nprepared -> ${path.relative(ROOT, OUT)}`);
