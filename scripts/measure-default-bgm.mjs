// What gain brings each default BGM to the pool's reference level.
//
//   node scripts/measure-default-bgm.mjs
//
// The SFX pool has done this since it was built (fetch-default-sfx.mjs writes a
// measured gain per file into catalog.json) and the BGM pool never did — so two
// tracks mastered 5.5 dB apart were handed the same multiplier, and the film's
// music level was really whoever mastered the chosen track. The composition's
// `FULL` was therefore not a mix decision, it was one file's mastering.
//
// The bytes are gitignored, so the RESULT is committed in lib/assets/defaults.ts
// rather than recomputed at runtime. Re-run this when a track is added or
// replaced, and paste the numbers in.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Reference level for a music bed, and NOT the SFX pool's −20 dB.
 *
 * A cue is a transient that has to be heard over a mix; a bed has to carry a
 * frame on its own in the opening and then sit under the words. −20 dB does the
 * second job and fails the first: measured in the walkthrough, the opening mark
 * played at −26 dB against an −18 dB voice, which is what 「BGMがすごい
 * ちっちゃい」 sounds like.
 *
 * −16 dB is the highest the quieter of the two tracks can reach: ink-cinematic
 * has only 1.4 dB of peak headroom, so anything louder clips rather than
 * levels. The ceiling here is the pool's, not a preference — add a track with
 * more headroom and this can rise.
 */
const TARGET_DB = -16;
/** Never louder than this, whatever the RMS maths asks for. */
const PEAK_CEILING_DB = -0.8;
const DIR = "public/defaults/bgm";

const meanDb = (file) => {
  // volumedetect reports on STDERR, which is where every ffmpeg filter log goes.
  // Reading only stdout finds nothing and looks like an unreadable file.
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const log = `${run.stderr ?? ""}${run.stdout ?? ""}`;
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(log);
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(log);
  if (!mean || !peak) throw new Error(`音量を測れませんでした: ${file}`);
  return { mean: Number(mean[1]), peak: Number(peak[1]) };
};

const files = readdirSync(DIR).filter((name) => name.endsWith(".mp3")).sort();
if (files.length === 0) {
  console.log(`${DIR} に mp3 がありません（bytes は gitignore されています）`);
  process.exit(0);
}

console.log(`基準 ${TARGET_DB} dB / ピーク上限 ${PEAK_CEILING_DB} dB\n`);
for (const name of files) {
  const { mean, peak } = meanDb(path.join(DIR, name));
  // Whichever runs out first: the loudness target, or the headroom. Lifting a
  // track past its own peak is clipping, not levelling.
  const wanted = 10 ** ((TARGET_DB - mean) / 20);
  const allowed = 10 ** ((PEAK_CEILING_DB - peak) / 20);
  const gain = Math.min(wanted, allowed);
  const limited = allowed < wanted ? "  ← ピーク制限" : "";
  console.log(
    `  ${name.padEnd(28)} RMS ${mean.toFixed(1)} / peak ${peak.toFixed(1)} dB  →  gain ${gain.toFixed(3)}${limited}`,
  );
}
