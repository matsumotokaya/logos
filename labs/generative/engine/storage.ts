// Own-storage for generated images (即時回収の受け皿). Server only.
//
// Preferred backend is Cloudflare R2; local disk remains as the zero-setup
// fallback for dev/test sessions without R2 credentials. The UI and the job
// log only ever reference our /api/labs/generative/outputs/<name> URL.
// External provider URLs (Recraft's ~24h public links etc.) are never stored.

import path from "node:path";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { getR2Object, isR2Configured, putR2Object } from "@/lib/r2";

const OUT_DIR = path.join(process.cwd(), "var", "generative-lab", "outputs");
const R2_PREFIX = "labs/generative/outputs";

const NAME_RE = /^gen-[a-z0-9]+-[a-f0-9]{8}\.png$/;

export function outputUrl(name: string): string {
  return `/api/labs/generative/outputs/${name}`;
}

function outputKey(name: string): string {
  return `${R2_PREFIX}/${name}`;
}

export async function saveOutput(png: Buffer): Promise<{ name: string; url: string }> {
  const name = `gen-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.png`;
  if (isR2Configured()) {
    await putR2Object(
      outputKey(name),
      png,
      "image/png",
      "private, max-age=31536000, immutable",
    );
    return { name, url: outputUrl(name) };
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, name), png);
  return { name, url: outputUrl(name) };
}

export async function readOutput(name: string): Promise<Buffer> {
  if (!NAME_RE.test(name)) throw new Error("不正な出力ファイル名");
  if (isR2Configured()) {
    const png = await getR2Object(outputKey(name));
    if (!png) throw new Error("出力が見つからない");
    return png;
  }
  return readFile(path.join(OUT_DIR, name));
}
