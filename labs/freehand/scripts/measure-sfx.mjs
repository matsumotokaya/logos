// Measure how loud each effect actually is, so the cue sheet can ask for a
// FEELING instead of a number.
//
// The first cut of sfx.ts set `volume` by taste — 0.42 for the opening clap,
// 0.22 for the chapter turn — and the result was measurably backwards: the
// clap arrived 3.5 dB quieter than the transitions it was supposed to outrank,
// and the bell for the speakers was inaudible (+25 RMS against +887 for the
// transition, measured by differencing the v2 and v3 renders).
//
// The cause is that supplied effects are not mastered to a common level. 鈴 is
// 8 dB quieter than シーン切り替え. Multiplying both by a hand-picked number
// preserves that difference instead of removing it. So: measure each file,
// normalise to a reference, and let sfx.ts carry only the editorial weight —
// which cue should feel more present than which.
//
// This is the same move as normalize-marks.mjs makes for logos: the supplied
// asset's own units are not the units the design wants to think in.
//
// Deterministic, ffmpeg only, no model. Run from the repository root:
//   node labs/freehand/scripts/measure-sfx.mjs

import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SFX_DIR = path.join(
  process.cwd(),
  "labs/freehand/sake-2026/public/assets/sfx",
);
const OUT = path.join(
  process.cwd(),
  "labs/freehand/sake-2026/src/freehand/sfx-levels.json",
);

/**
 * The level every cue is normalised to before its editorial weight applies.
 *
 * Measured over the first second rather than the whole file, because that is
 * the part that has to land against a cut — a 3.4s koto glissando that decays
 * into silence would otherwise be judged by its own tail and pushed too loud.
 */
const REFERENCE_DB = -20;
/** No file gets pushed further than this, or its noise floor comes up too. */
const MAX_GAIN = 3;

const meanDb = (file, seconds) => {
  // volumedetect reports on stderr, which is where ffmpeg puts everything that
  // is not the stream itself.
  const { stderr } = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-t", String(seconds), "-i", file, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const match = /mean_volume:\s*(-?\d+(?:\.\d+)?) dB/.exec(stderr ?? "");
  if (!match) throw new Error(`no mean_volume for ${file}`);
  return Number(match[1]);
};

const levels = {};
for (const name of readdirSync(SFX_DIR).filter((f) => f.endsWith(".mp3")).sort()) {
  const file = path.join(SFX_DIR, name);
  const head = meanDb(file, 1);
  const whole = meanDb(file, 60);
  const gain = Math.min(MAX_GAIN, Math.pow(10, (REFERENCE_DB - head) / 20));
  levels[name] = {
    headDb: Number(head.toFixed(1)),
    meanDb: Number(whole.toFixed(1)),
    gain: Number(gain.toFixed(3)),
  };
  console.log(
    `${name.padEnd(20)} head ${head.toFixed(1).padStart(6)} dB  ` +
      `mean ${whole.toFixed(1).padStart(6)} dB  → gain ${gain.toFixed(3)}`,
  );
}

writeFileSync(OUT, `${JSON.stringify(levels, null, 2)}\n`);
console.log(`\n${OUT}`);
