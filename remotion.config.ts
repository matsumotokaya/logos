// Remotion CLI configuration (MP4 rendering / Studio only — the in-app
// <Player> is bundled by Next and never reads this file). The public dir is
// passed per render by labs/campaign/scripts/render-cm.mjs so audio can be
// resolved from var/campaign-lab/jobs/ or public/campaigns/.

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
