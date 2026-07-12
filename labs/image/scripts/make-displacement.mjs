// Generates the fabric displacement map for the tote-bag template.
// R shifts x, G shifts y, 128 = neutral (see core/template-format.ts).
// Committed output: templates/tote-bag/displace.png — rerun only to retune.
//
//   node labs/image/scripts/make-displacement.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
  "tote-bag",
  "displace.png",
);

// Low-frequency blobs: small gaussian noise field, heavy blur, then upscale.
// Blur pulls values toward the 128 mean, so re-stretch contrast around 128.
const SMALL_W = 200;
const SMALL_H = 250;
const OUT_W = 800;
const OUT_H = 1000;

const noise = await sharp({
  create: {
    width: SMALL_W,
    height: SMALL_H,
    channels: 3,
    noise: { type: "gaussian", mean: 128, sigma: 48 },
  },
})
  .blur(10)
  .linear(4.5, -448) // v' = 4.5v - 448 keeps the 128 mean fixed
  .resize(OUT_W, OUT_H, { fit: "fill" })
  .png()
  .toBuffer();

await sharp(noise).toFile(OUT);

const stats = await sharp(OUT).stats();
console.log(
  "wrote",
  OUT,
  stats.channels.map((c) => `mean=${c.mean.toFixed(1)} σ=${c.stdev.toFixed(1)}`).join(" | "),
);
