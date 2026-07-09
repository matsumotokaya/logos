// Client-side SVG -> PNG rasterizer (used to feed the logo to image-generation APIs).

import { svgToDataUri } from "./svg";

export async function rasterizeSvg(
  svg: string,
  size = 1024,
  background = "#FFFFFF"
): Promise<string> {
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterize the logo."));
  });
  img.src = svgToDataUri(svg);
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  const iw = img.naturalWidth || 300;
  const ih = img.naturalHeight || 150;
  const pad = size * 0.15;
  const scale = Math.min((size - pad * 2) / iw, (size - pad * 2) / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  return canvas.toDataURL("image/png");
}
