// Does a delivered picture actually leave the copy side alone?
//
//   node scripts/check-pool-images.mjs <dir|file> [--tone ink|light]
//
// The requirement every event-cm layout imposes is that the words sit on the
// left, so the picture has to give that side up (docs/demo-assets.md §5). Which
// DIRECTION it gives it up in depends on the art direction, and this is exactly
// the thing that cannot be eyeballed: `sumi` darkens the copy side with
// rgba(8,6,4) at 0.74, `standard` lightens it with rgba(247,249,252) at 0.84 —
// so the same photograph is right for one and grey fog in the other, and the
// difference is a number.
//
// Run BEFORE renaming a delivery into the pool. A picture that fails here will
// not be saved by anything downstream: the scrim is the last layer, and it
// cannot add detail back to a side that never had any.

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const toneArg = args[args.indexOf("--tone") + 1];
const tone = args.includes("--tone") ? toneArg : "light";
if (!target) {
  console.error("usage: node scripts/check-pool-images.mjs <dir|file> [--tone ink|light]");
  process.exit(1);
}
if (tone !== "ink" && tone !== "light") {
  console.error(`--tone は ink か light（渡された値: ${tone}）`);
  process.exit(1);
}

/** Long edge below this goes soft once Ken Burns pushes in (§5 rule 1). */
const MIN_LONG_EDGE = 2560;
/**
 * A portrait is not held to that.
 *
 * It is never a backdrop and never pushed: the full-bleed speaker panel is
 * 960×1080 and the medallion is smaller still, so a 960×1200 delivery is used
 * at native size. Asking for 2560 here would be asking for four times the
 * pixels of the largest place it is ever drawn.
 */
const MIN_PORTRAIT_EDGE = 1080;
/** Ken Burns' widest push, so the same warning fires for either theme. */
const PUSH = 1.13;

const files = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => path.join(target, f))
  : [target];

/** Mean brightness and how much it varies, 0..1, over one region. */
const region = async (file, box) => {
  // `toBuffer({ resolveWithObject: true })` so the pixels come back as a
  // Buffer with its own metadata; the bare form returns a Promise of the
  // buffer for some inputs and an object for others, and one of those is not
  // iterable.
  const { data } = await sharp(file)
    .extract(box)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = Uint8Array.from(data);
  let sum = 0;
  for (const v of pixels) sum += v;
  const mean = sum / pixels.length;
  let variance = 0;
  for (const v of pixels) variance += (v - mean) ** 2;
  return { mean: mean / 255, sd: Math.sqrt(variance / pixels.length) / 255 };
};

let failures = 0;
for (const file of files) {
  const meta = await sharp(file).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const portrait = h > w;
  const notes = [];

  const longEdge = Math.max(w, h);
  const minEdge = portrait ? MIN_PORTRAIT_EDGE : MIN_LONG_EDGE;
  if (longEdge < minEdge) {
    notes.push(
      portrait
        ? `長辺${longEdge}px（パネルは960×1080なので${minEdge}px以上）`
        : `長辺${longEdge}px（Ken Burnsで実効${Math.round(longEdge / PUSH)}px相当・${minEdge}px以上が要件）`,
    );
  }

  // A portrait is a face and has no copy side: it is cropped to a medallion and
  // to a full-height panel, so what matters is that its ground is even.
  if (portrait) {
    const ground = await region(file, {
      left: 0,
      top: 0,
      width: Math.floor(w * 0.18),
      height: Math.floor(h * 0.5),
    });
    console.log(
      `${path.basename(file).slice(0, 40).padEnd(42)} ${w}x${h} 人物 | 地の明度 ${ground.mean.toFixed(3)} ばらつき ${ground.sd.toFixed(3)}` +
        (notes.length ? `\n    ⚠ ${notes.join(" / ")}` : ""),
    );
    if (tone === "light" && ground.mean < 0.45) {
      console.log("    ⚠ 地が暗い（白い映像で1枚だけ重く見える）");
    }
    if (notes.length) failures += 1;
    continue;
  }

  const third = Math.floor(w / 3);
  const copy = await region(file, { left: 0, top: 0, width: third, height: h });
  const subject = await region(file, { left: third, top: 0, width: w - third, height: h });
  const lowerLeft = await region(file, {
    left: 0,
    top: Math.floor(h * 0.55),
    width: third,
    height: h - Math.floor(h * 0.55),
  });

  // The copy side has to be on the far side of the subject from the type, and
  // it has to be QUIET: a busy bright wall is as unreadable as a busy dark one.
  const brighter = copy.mean > subject.mean;
  const wanted = tone === "light";
  if (brighter !== wanted) {
    notes.push(
      wanted
        ? `左1/3が右2/3より暗い（${copy.mean.toFixed(3)} < ${subject.mean.toFixed(3)}）`
        : `左1/3が右2/3より明るい（${copy.mean.toFixed(3)} > ${subject.mean.toFixed(3)}）`,
    );
  }
  if (copy.sd > 0.13) {
    notes.push(`左1/3のばらつき ${copy.sd.toFixed(3)}（文字が細部を横切る）`);
  }

  console.log(
    `${path.basename(file).slice(0, 40).padEnd(42)} ${w}x${h} | 左1/3 ${copy.mean.toFixed(3)}±${copy.sd.toFixed(3)} 右2/3 ${subject.mean.toFixed(3)}±${subject.sd.toFixed(3)} 左下 ${lowerLeft.mean.toFixed(3)}±${lowerLeft.sd.toFixed(3)} ${notes.length ? "✗" : "✓"}` +
      (notes.length ? `\n    ⚠ ${notes.join(" / ")}` : ""),
  );
  if (notes.length) failures += 1;
}

console.log(
  `\n${files.length}件中 ${failures}件に注意点あり（tone=${tone}・合否は var/theme-compare の実物で最終判断）`,
);
