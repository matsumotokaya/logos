// Campaign pipeline CLI — run the full Tier S pipeline (capture → palette
// candidates → VLM adjudication → creative → LP → self-verification) from the
// terminal, without the web UI or Labs auth. Imports the same lib/campaign
// modules the API route uses, so there is exactly one pipeline implementation.
//
// Usage (from the repo root):
//   npm run campaign -- <url> [--name NAME] [--desc TEXT] [--shots DIR] [--no-verify]
//   npm run campaign -- --name "MyApp" --desc "..." --shots ./materials
//
// --shots accepts a directory of PDFs and images (flyers, decks, screenshots).
// Output: var/campaign/<slug>/{brandkit.json, index.html, narration.txt}
//         plus debug artifacts: candidates.json, original.jpg, lp.jpg
//
// Note: the npm script sets NODE_OPTIONS=--conditions=react-server so the
// "server-only" guard inside lib/campaign resolves to its no-op build.

import fs from "node:fs";
import path from "node:path";
import type { SourceFile } from "../../../lib/campaign/creative";
import { runCampaignPipeline } from "../../../lib/campaign/pipeline";

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
  verify: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { url: null, verify: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") args.name = argv[++i];
    else if (a === "--desc") args.desc = argv[++i];
    else if (a === "--shots") args.shotsDir = argv[++i];
    else if (a === "--no-verify") args.verify = false;
    else if (!a.startsWith("--")) args.url = a;
  }
  if (!args.url && !args.name) {
    console.error(
      "Usage: npm run campaign -- <url> [--name NAME] [--desc TEXT] [--shots DIR] [--no-verify]"
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
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY が .env.local にありません");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));

  const files: SourceFile[] = args.shotsDir ? loadSourceFiles(args.shotsDir) : [];
  if (files.length) console.log(`sources: ${files.length}ファイル読み込み`);

  const result = await runCampaignPipeline(
    {
      url: args.url,
      userName: args.name,
      userDescription: args.desc,
      files,
    },
    {
      verify: args.verify,
      onProgress: (e) => {
        const mark = e.level === "success" ? "✓" : e.level === "warn" ? "⚠" : "…";
        console.log(`[${new Date().toISOString().slice(11, 19)}] ${mark} ${e.message}`);
      },
    }
  );

  const { kit, html, meta } = result;
  console.log(`\nservice: ${kit.service.name} / ${kit.service.tagline}`);
  console.log(
    `analysis: ${kit.service.industry} / ${kit.service.business_type} — ${kit.service.offering}`
  );
  if (kit.design_tokens) {
    const t = Object.entries(kit.design_tokens)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    if (t) console.log(`tokens: ${t}`);
  }
  console.log(`logo: ${kit.assets?.logo ? "captured" : "none (wordmark fallback)"}`);
  console.log(
    `palette: ${kit.brand.primary} / ${kit.brand.accent} on ${kit.brand.background} (${kit.brand.mode}, source=${kit.brand.palette_source})`
  );
  if (meta.candidates) {
    console.log(`candidates (${meta.candidates.length}):`);
    for (const c of meta.candidates)
      console.log(`  ${c.hex}  ${c.evidence.join(" / ") || "補助候補"}`);
  }
  if (meta.verification) {
    console.log(
      `verification: ${meta.verification.verdict}${meta.verification.retried ? " (1回再生成)" : ""} — ${meta.verification.reason}`
    );
  }

  const outDir = path.join("var", "campaign", slugify(args.name ?? args.url ?? "output"));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "brandkit.json"), JSON.stringify(kit, null, 2));
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.writeFileSync(path.join(outDir, "narration.txt"), kit.narration + "\n");
  if (meta.candidates)
    fs.writeFileSync(
      path.join(outDir, "candidates.json"),
      JSON.stringify(meta.candidates, null, 2)
    );
  if (result.debug.capture)
    fs.writeFileSync(
      path.join(outDir, "original.jpg"),
      Buffer.from(result.debug.capture.screenshots.desktop, "base64")
    );
  if (result.debug.lpShot)
    fs.writeFileSync(path.join(outDir, "lp.jpg"), Buffer.from(result.debug.lpShot, "base64"));
  if (kit.assets?.logo)
    fs.writeFileSync(path.join(outDir, "logo.png"), Buffer.from(kit.assets.logo.data, "base64"));

  console.log(`\n完了: ${outDir}/`);
  console.log(`プレビュー: open ${path.join(outDir, "index.html")}`);
}

main().catch((err) => {
  console.error("エラー:", err instanceof Error ? err.message : err);
  process.exit(1);
});
