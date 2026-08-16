// Remotion CLI configuration (MP4 rendering / Studio only — the in-app
// <Player> is bundled by Next and never reads this file). The public dir is
// passed per render by labs/campaign/scripts/render-cm.mjs so audio can be
// resolved from var/campaign-lab/jobs/ or public/campaigns/.

import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The CLI's webpack does not read tsconfig `paths`, so the alias every other
// part of this codebase uses has to be declared again here.
//
// Compositions used to avoid `@/` for exactly this reason, and that worked only
// while the templates were self-contained. The component kit is not: event-cm is
// built from `@/remotion/kit/*` and reads `@/lib/event-cm/facts`, so without
// this the narrated film cannot be bundled at all — and the moment `event/`
// borrowed one helper from the kit, event-promo could not either. Declaring the
// alias once is the fix; asking every composition to stay alias-free is a rule
// that silently expires.
//
// The exported project (lib/export/project-zip.ts) writes the same override
// into its own config, pointed at its own `src/`.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@": path.join(process.cwd()),
    },
  },
}));
