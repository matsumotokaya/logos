// Renders the same seeded film in each art direction, one still per scene.
//
// The point is to LOOK at a new theme rather than trust its numbers: the values
// that had to be lifted out of the composition (letterbox colour, caption
// plate, directional scrim) are exactly the ones a light theme gets wrong
// silently. Writes var/theme-compare/<themeId>-<scene>.png.
//
//   npx tsx scripts/compare-art-directions.ts

import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { seedEventCmBrief } from "@/lib/event-cm/seed";
import { eventCmFilm } from "@/remotion/event-cm/film";
import { THEMES } from "@/remotion/kit/theme";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const OUT = path.resolve("var/theme-compare");

async function main() {
  const base = seedEventCmBrief(
    { name: "みらい経営研究所", industry: "コンサルティング" },
    { now: new Date("2026-08-21T00:00:00Z"), seed: "compare" },
  );

  // The same alias override remotion.config.ts declares for the CLI. A direct
  // bundle() call does not read that file, and without it the kit's `@/`
  // imports cannot resolve at all.
  const serveUrl = await bundle({
    entryPoint: path.resolve("remotion/index.ts"),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: { ...config.resolve?.alias, "@": path.join(process.cwd()) },
      },
    }),
  });

  for (const themeId of Object.keys(THEMES)) {
    const brief: EventCmBrief = { ...base, artDirection: themeId };
    const film = eventCmFilm(brief);
    const composition = await selectComposition({
      serveUrl,
      id: "event-cm",
      inputProps: { brief },
    });
    console.log(`\n[${themeId}] ${film.scenes.length} シーン / ${(film.totalMs / 1000).toFixed(1)}秒`);
    for (const scene of film.scenes) {
      // Mid-scene, so entrance animations have finished.
      const frame = Math.round(((scene.fromMs + scene.durationMs / 2) / 1000) * composition.fps);
      const out = path.join(OUT, `${themeId}-${scene.key}.png`);
      await renderStill({
        composition: {
          ...composition,
          durationInFrames: Math.ceil((film.totalMs / 1000) * composition.fps),
        },
        serveUrl,
        output: out,
        frame,
        inputProps: { brief },
        overwrite: true,
      });
      console.log(`  ${scene.key.padEnd(12)} frame ${String(frame).padStart(5)} -> ${path.basename(out)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
