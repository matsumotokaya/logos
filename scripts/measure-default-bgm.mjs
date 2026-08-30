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
//
// It writes `gain` only. `gainAdjustDb` beside it is somebody's listening, and
// measurement has no opinion about it — the two are separate fields precisely
// so re-running this cannot quietly undo a decision made by ear.

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
 * −16 was the next answer and was still too quiet — twice (2026-08-26:
 * 「3分の1ぐらいしかない」, then 「まだ若干小さい」 after a first raise). The
 * mistake was where the number came from: −16 is the loudest ink-cinematic can
 * reach with its 1.4 dB of headroom, and applying it to a track mastered to
 * full scale threw away 5 dB of that track's own loudness for a symmetry
 * nobody asked for. So the target is now deliberately ABOVE what either file
 * can reach, and the peak ceiling does the deciding: every track plays as loud
 * as it goes. A track with real headroom will land on the target instead, which
 * is what keeps this a level and not a free-for-all.
 */
const TARGET_DB = -10;
/**
 * Never louder than this, whatever the RMS maths asks for.
 *
 * −0.8 dBFS, and it is why ink-cinematic's 1.072 has not moved through two
 * raises — approved 墨 films are mixed at that number. Verified against the
 * finished mix rather than trusted: `ffmpeg -af volumedetect` on the rendered
 * soundtrack has to stay under 0 dB with the cues summed in.
 */
const PEAK_CEILING_DB = -0.8;
/**
 * And never above 1.0, whatever the peak allows.
 *
 * Remotion documents `volume` as 0–1 (rules/audio.md). Above 1 the two surfaces
 * are outside the contract and stop agreeing — which is what produced 「プレ
 * ビューで微調整してMP4に書き出すと全部バランスが変わってしまう」 (owner,
 * 2026-08-30). A level a person tuned in the browser and a level the encoder
 * applies have to be the same number, and the only range where they certainly
 * are is this one.
 *
 * It costs ink-cinematic 0.6 dB, which is inaudible, and it costs the pool
 * nothing else: every other track is peak-limited below 1 anyway. Loudness
 * above this belongs to the FILE — remaster it — not to the player.
 */
const GAIN_CEILING = 1;
const DIR = "public/defaults/bgm";

const meanDb = (file, startFromSec = 0) => {
  // volumedetect reports on STDERR, which is where every ffmpeg filter log goes.
  // Reading only stdout finds nothing and looks like an unreadable file.
  //
  // MEASURED FROM WHERE PLAYBACK STARTS. bright-corporate is trimmed 14s in
  // (lib/assets/defaults.ts `startFromSec`), and its intro is 7–9 dB under its
  // body — so measuring the whole file describes a passage the film never
  // plays, and levels the track by it.
  const run = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      ...(startFromSec > 0 ? ["-ss", String(startFromSec)] : []),
      "-i",
      file,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  const log = `${run.stderr ?? ""}${run.stdout ?? ""}`;
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(log);
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(log);
  if (!mean || !peak) throw new Error(`音量を測れませんでした: ${file}`);
  return { mean: Number(mean[1]), peak: Number(peak[1]) };
};

// The trims the pool declares, so this script measures what the film plays.
// Imported rather than restated: two places holding "start 14 seconds in" is
// how one of them goes stale.
const { DEFAULT_ASSETS } = await import("../lib/assets/defaults.ts");
const assetOf = (name) =>
  DEFAULT_ASSETS.find((asset) => asset.src === `defaults/bgm/${name}`);
const startOf = (name) => assetOf(name)?.startFromSec ?? 0;
// Printed, never recomputed. It is somebody's listening, and this script only
// knows how to measure (lib/assets/defaults.ts `gainAdjustDb`).
const adjustOf = (name) => assetOf(name)?.gainAdjustDb ?? 0;

const files = readdirSync(DIR).filter((name) => name.endsWith(".mp3")).sort();
if (files.length === 0) {
  console.log(`${DIR} に mp3 がありません（bytes は gitignore されています）`);
  process.exit(0);
}

console.log(`基準 ${TARGET_DB} dB / ピーク上限 ${PEAK_CEILING_DB} dB\n`);
for (const name of files) {
  const from = startOf(name);
  const { mean, peak } = meanDb(path.join(DIR, name), from);
  // Whichever runs out first: the loudness target, or the headroom. Lifting a
  // track past its own peak is clipping, not levelling.
  const wanted = 10 ** ((TARGET_DB - mean) / 20);
  const allowed = 10 ** ((PEAK_CEILING_DB - peak) / 20);
  const gain = Math.min(wanted, allowed, GAIN_CEILING);
  const limited =
    GAIN_CEILING < Math.min(wanted, allowed)
      ? "  ← 1.0上限"
      : allowed < wanted
        ? "  ← ピーク制限"
        : "";
  const adjust = adjustOf(name);
  const byEar = adjust !== 0 ? `  ＋耳で ${adjust > 0 ? "+" : ""}${adjust} dB` : "";
  console.log(
    `  ${name.padEnd(28)}${from > 0 ? ` (${from}s〜)` : "        "} RMS ${mean.toFixed(1)} / peak ${peak.toFixed(1)} dB  →  gain ${gain.toFixed(3)}${limited}${byEar}`,
  );
}
