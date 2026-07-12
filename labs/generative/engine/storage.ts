// Own-storage for generated images (即時回収の受け皿). Server only.
//
// Every generation is persisted under var/generative-lab/outputs/ the moment
// the provider returns bytes; the UI and the job log only ever reference our
// /api/labs/generative/outputs/<name> URL. External provider URLs (Recraft's
// ~24h public links etc.) are never stored anywhere.

import path from "node:path";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT_DIR = path.join(process.cwd(), "var", "generative-lab", "outputs");

const NAME_RE = /^gen-[a-z0-9]+-[a-f0-9]{8}\.png$/;

export function outputUrl(name: string): string {
  return `/api/labs/generative/outputs/${name}`;
}

export async function saveOutput(png: Buffer): Promise<{ name: string; url: string }> {
  const name = `gen-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.png`;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, name), png);
  return { name, url: outputUrl(name) };
}

export async function readOutput(name: string): Promise<Buffer> {
  if (!NAME_RE.test(name)) throw new Error("不正な出力ファイル名");
  return readFile(path.join(OUT_DIR, name));
}
