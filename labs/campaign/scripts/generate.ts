// Campaign pipeline CLI — run ingest → creative → LP from the terminal,
// without the web UI or Labs auth. Imports the same lib/campaign modules the
// API route uses, so there is exactly one pipeline implementation.
//
// Usage (from the repo root):
//   npm run campaign -- <url> [--name NAME] [--desc TEXT] [--shots DIR]
//   npm run campaign -- --name "MyApp" --desc "..." --shots ./materials
//
// --shots accepts a directory of PDFs and images (flyers, decks, screenshots).
// Output: var/campaign/<slug>/{brandkit.json, index.html, narration.txt}
//
// Note: the npm script sets NODE_OPTIONS=--conditions=react-server so the
// "server-only" guard inside lib/campaign resolves to its no-op build.

import fs from "node:fs";
import path from "node:path";
import { scrapeUrl, fetchImageAsBase64, type RawServiceInfo } from "../../../lib/campaign/ingest";
import { generateBrandKit, type SourceFile } from "../../../lib/campaign/creative";
import { renderLandingPage } from "../../../lib/campaign/render-lp";

// Minimal .env.local loader (Next.js loads it automatically; plain Node does not).
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

interface CliArgs {
  url: string | null;
  name?: string;
  desc?: string;
  shotsDir?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { url: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") args.name = argv[++i];
    else if (a === "--desc") args.desc = argv[++i];
    else if (a === "--shots") args.shotsDir = argv[++i];
    else if (!a.startsWith("--")) args.url = a;
  }
  if (!args.url && !args.name) {
    console.error(
      "Usage: npm run campaign -- <url> [--name NAME] [--desc TEXT] [--shots DIR]"
    );
    process.exit(1);
  }
  return args;
}

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function loadSourceFiles(dir: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const ext = path.extname(f).toLowerCase();
    const buf = fs.readFileSync(path.join(dir, f));
    if (buf.length > 4_500_000) {
      console.warn(`skip ${f}: larger than 4.5MB`);
      continue;
    }
    if (ext === ".pdf") {
      files.push({ kind: "pdf", data: buf.toString("base64") });
    } else if (IMAGE_TYPES[ext]) {
      files.push({ kind: "image", mediaType: IMAGE_TYPES[ext], data: buf.toString("base64") });
    }
  }
  return files;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "output"
  );
}

async function main() {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が .env.local にありません");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));

  let raw: RawServiceInfo | null = null;
  if (args.url) {
    console.log(`[1/3] ingest: ${args.url} を解析中...`);
    raw = await scrapeUrl(args.url);
    console.log(`      title: ${raw.title ?? "(none)"}`);
    console.log(`      colors: ${raw.colorHints.slice(0, 5).join(", ") || "(none)"}`);
  } else {
    console.log("[1/3] ingest: URLなし（ユーザー入力のみで生成）");
  }

  const files: SourceFile[] = args.shotsDir ? loadSourceFiles(args.shotsDir) : [];
  if (files.length) console.log(`      sources: ${files.length}ファイル読み込み`);
  if (!files.some((f) => f.kind === "image") && raw?.ogImage) {
    const og = await fetchImageAsBase64(raw.ogImage);
    if (og) {
      files.push({ kind: "image", mediaType: og.mediaType, data: og.data });
      console.log("      og:image をキービジュアルとして取得");
    }
  }

  console.log("[2/3] creative: Brand Kit を生成中...");
  const kit = await generateBrandKit({
    raw,
    userName: args.name,
    userDescription: args.desc,
    files,
  });
  console.log(`      service: ${kit.service.name} / ${kit.service.tagline}`);
  console.log(`      palette: ${kit.brand.primary} / ${kit.brand.accent} (${kit.brand.mode})`);

  console.log("[3/3] lp: LPをレンダリング中...");
  const html = renderLandingPage(kit);

  const outDir = path.join("var", "campaign", slugify(args.name ?? args.url ?? "output"));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "brandkit.json"), JSON.stringify(kit, null, 2));
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.writeFileSync(path.join(outDir, "narration.txt"), kit.narration + "\n");

  console.log(`\n完了: ${outDir}/`);
  console.log(`プレビュー: open ${path.join(outDir, "index.html")}`);
}

main().catch((err) => {
  console.error("エラー:", err instanceof Error ? err.message : err);
  process.exit(1);
});
