// Logo → reference PNG for the generation engines. Server only.
//
// SVGs are rendered at a matching density (sharp rasterizes at intrinsic
// size otherwise — same technique as the Workflow Lab compositor) and
// flattened onto white: image-to-image engines treat the input as a plain
// photo of the logo, and alpha edges read as artifacts.

import sharp from "sharp";
import type { GenerativeLogo } from "@/labs/generative/core/api-types";

const REFERENCE_PX = 1024;

export async function rasterizeReferenceLogo(
  logo: GenerativeLogo,
): Promise<Buffer> {
  if (logo.kind === "png") {
    const base64 = logo.dataUri.slice("data:image/png;base64,".length);
    return sharp(Buffer.from(base64, "base64"))
      .resize(REFERENCE_PX, REFERENCE_PX, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
  }

  const buf = Buffer.from(logo.svg);
  const meta = await sharp(buf).metadata();
  const intrinsicW = Math.max(meta.width ?? REFERENCE_PX, 1);
  const density = Math.min(Math.max(72 * (REFERENCE_PX / intrinsicW), 72), 9600);
  return sharp(buf, { density })
    .resize(REFERENCE_PX, REFERENCE_PX, { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}
