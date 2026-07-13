// Logo → reference PNG for the generation engines. Server only.
//
// SVGs are rendered at a matching density (sharp rasterizes at intrinsic
// size otherwise — same technique as the Workflow Lab compositor) and
// flattened onto white: image-to-image engines treat the input as a plain
// photo of the logo, and alpha edges read as artifacts.

import sharp from "sharp";
import type { GenerativeLogo } from "@/labs/generative/core/api-types";

const REFERENCE_PX = 1024;
// 実機確認(2026-07-14): Together は参照画像の高さ256〜4096を要求、Recraft は
// 最小辺256を要求する。極端に横長/縦長のロゴ(ワードマーク等)は fit:inside
// だけだと短辺がこれを割るため、白パディングで最小辺を確保する。
const MIN_SIDE_PX = 256;

async function padToMinSide(png: Buffer): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? REFERENCE_PX;
  const h = meta.height ?? REFERENCE_PX;
  if (w >= MIN_SIDE_PX && h >= MIN_SIDE_PX) return png;
  const padX = Math.max(0, Math.ceil((MIN_SIDE_PX - w) / 2));
  const padY = Math.max(0, Math.ceil((MIN_SIDE_PX - h) / 2));
  return sharp(png)
    .extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: "#ffffff",
    })
    .png()
    .toBuffer();
}

export async function rasterizeReferenceLogo(
  logo: GenerativeLogo,
): Promise<Buffer> {
  if (logo.kind === "png") {
    const base64 = logo.dataUri.slice("data:image/png;base64,".length);
    const png = await sharp(Buffer.from(base64, "base64"))
      .resize(REFERENCE_PX, REFERENCE_PX, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    return padToMinSide(png);
  }

  const buf = Buffer.from(logo.svg);
  const meta = await sharp(buf).metadata();
  const intrinsicW = Math.max(meta.width ?? REFERENCE_PX, 1);
  const density = Math.min(Math.max(72 * (REFERENCE_PX / intrinsicW), 72), 9600);
  const png = await sharp(buf, { density })
    .resize(REFERENCE_PX, REFERENCE_PX, { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return padToMinSide(png);
}
