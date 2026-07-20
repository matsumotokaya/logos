// Local MP4 export of a campaign's 30s CM — Phase 0b's "server render".
//
// MP4 rendering needs headless Chrome, which cannot run on Vercel serverless
// functions; locally the Remotion CLI handles everything (it downloads its
// own Chrome Headless Shell on first run). The future cloud path (Remotion
// Lambda on AWS) replaces this script but keeps the same composition and
// props contract, so nothing else changes.
//
// Usage:
//   npm run campaign:render -- --job <jobId>     # a generated campaign
//   npm run campaign:render -- --sample          # the bundled sample
//   (append --out <path> to override the output location)

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const JOBS_DIR = path.join(ROOT, "var", "campaign-lab", "jobs");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const readFlag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const jobId = readFlag("--job");
const sample = args.includes("--sample");
let propsPath;
let publicDir;
let out = readFlag("--out");

// The default BGM lives in public/campaigns; Remotion resolves staticFile()
// names relative to a single --public-dir, so for job renders we copy it into
// the jobs dir next to the per-job audio and reference it by name.
const BGM_SRC = path.join(ROOT, "public", "campaigns", "bgm.mp3");
const ensureBgm = (dir) => {
  if (!fs.existsSync(BGM_SRC)) return null;
  const dst = path.join(dir, "bgm.mp3");
  if (path.resolve(dst) !== path.resolve(BGM_SRC)) fs.copyFileSync(BGM_SRC, dst);
  return "bgm.mp3";
};

if (sample) {
  publicDir = path.join(ROOT, "public", "campaigns");
  out ??= path.join(ROOT, "var", "campaign-lab", "sample-cm.mp4");
  const samplePropsPath = path.join(ROOT, "var", "campaign-lab", "sample-cm-props.json");
  if (!fs.existsSync(samplePropsPath))
    fail("sample props not found — run `npm run campaign:sample-voice` first.");
  // Re-emit props with bgmSrc merged in (keeps sample-voice output simple).
  const sp = JSON.parse(fs.readFileSync(samplePropsPath, "utf8"));
  sp.bgmSrc = ensureBgm(publicDir);
  propsPath = path.join(ROOT, "var", "campaign-lab", "sample-cm-props.render.json");
  fs.writeFileSync(propsPath, JSON.stringify(sp));
} else if (jobId) {
  const jobPath = path.join(JOBS_DIR, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) fail(`job not found: ${jobPath}`);
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  if (!job.kit) fail("job has no Brand Kit (generation not finished?)");
  // status may still be "running" when the web flow renders right after the
  // voice stage — the track + WAV are all this render needs.
  if (!job.cm?.track)
    fail("job has no CM voice track — generate it from /campaigns/[id] first.");
  const wav = path.join(JOBS_DIR, `${jobId}.cm.wav`);
  if (!fs.existsSync(wav)) fail(`voice audio not found: ${wav}`);

  publicDir = JOBS_DIR;
  propsPath = path.join(JOBS_DIR, `${jobId}.cm-props.json`);
  fs.writeFileSync(
    propsPath,
    JSON.stringify({
      kit: job.kit,
      track: job.cm.track,
      audioSrc: `${jobId}.cm.wav`,
      bgmSrc: ensureBgm(publicDir),
    })
  );
  out ??= path.join(JOBS_DIR, `${jobId}.cm.mp4`);
} else {
  fail("usage: npm run campaign:render -- --job <jobId> | --sample [--out <path>]");
}

console.log(`rendering -> ${out}`);
const r = spawnSync(
  "npx",
  [
    "remotion",
    "render",
    "remotion/index.ts",
    "cm",
    out,
    `--props=${propsPath}`,
    `--public-dir=${publicDir}`,
  ],
  { cwd: ROOT, stdio: "inherit" }
);
process.exit(r.status ?? 1);
