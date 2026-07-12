// Mock provider — the no-key fallback that keeps the whole harness
// exercisable (templates, dials, prompt assembly, cost log, storage, UI)
// before any API key exists. Deterministic: the prompt hashes to a hue, so
// the same template+preset renders the same stage. Clearly watermarked —
// a mock must never be mistaken for a real generation.
//
// The logo never leaves this server on the mock path (logoSentTo: null in
// the audit log).

import sharp from "sharp";
import type { Provider, ProviderInput, ProviderOutput } from "./types";

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

function stageSvg(w: number, h: number, hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 32%, 88%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 30%, 68%)"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.6" stop-color="black" stop-opacity="0"/>
      <stop offset="1" stop-color="black" stop-opacity="0.28"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
}

function watermarkSvg(w: number): string {
  const fs = Math.max(12, Math.round(w * 0.016));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${fs * 3}">
  <rect width="100%" height="100%" fill="black" fill-opacity="0.55"/>
  <text x="${fs}" y="${fs * 1.9}" font-family="monospace" font-size="${fs}" fill="white">MOCK RENDER — APIキー未設定のためエンジン未呼び出し(コスト $0)</text>
</svg>`;
}

async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const { width: w, height: h } = input;
  const hue = hashHue(input.prompt);

  const logoW = Math.round(w * 0.45);
  const logo = await sharp(input.logoPng)
    .resize(logoW, Math.round(h * 0.45), { fit: "inside" })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const wm = Buffer.from(watermarkSvg(w));
  const wmMeta = await sharp(wm).metadata();

  const png = await sharp(Buffer.from(stageSvg(w, h, hue)))
    .composite([
      {
        input: logo,
        left: Math.round((w - (logoMeta.width ?? logoW)) / 2),
        top: Math.round((h - (logoMeta.height ?? logoW)) / 2),
        blend: "multiply",
      },
      { input: wm, left: 0, top: h - (wmMeta.height ?? 40) },
    ])
    .png()
    .toBuffer();

  return { png, costUsd: 0 };
}

export const mockProvider: Provider = {
  id: "mock",
  name: "Mock (server-side composite)",
  roleJa: "モック: APIキー未設定時のフォールバック(ロゴはサーバー外に出ない)",
  costPerImageUsd: 0,
  available: () => true,
  generate,
};
