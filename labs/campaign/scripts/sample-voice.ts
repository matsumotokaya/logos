// Regenerate the bundled sample campaign's CM voice assets:
//   public/campaigns/sample-cm.wav        — the narration audio (committed)
//   lib/campaign/sample-cm-track.json     — scene/caption timings (committed)
//   var/campaign-lab/sample-cm-props.json — props file for a sample MP4 render
//
// Run whenever lib/campaign/sample.ts's cm_script changes:
//   npm run campaign:sample-voice        (needs GEMINI_API_KEY in .env.local,
//                                         or CAMPAIGN_TTS_MOCK=1 for the tone)

import fs from "node:fs";
import path from "node:path";
import { sampleCampaignKit } from "../../../lib/campaign/sample";
import { generateCmVoice, cmVoiceAvailable } from "../../../lib/campaign/voice";

const ROOT = path.join(import.meta.dirname, "..", "..", "..");

async function main() {
  if (!cmVoiceAvailable()) {
    console.error(
      "GEMINI_API_KEY is not set (and CAMPAIGN_TTS_MOCK != 1). Run with: node --env-file=.env.local または CAMPAIGN_TTS_MOCK=1"
    );
    process.exit(1);
  }

  const { wav, track } = await generateCmVoice(sampleCampaignKit, (message, level) =>
    console.log(`[${level ?? "info"}] ${message}`)
  );

  const wavPath = path.join(ROOT, "public", "campaigns", "sample-cm.wav");
  const trackPath = path.join(ROOT, "lib", "campaign", "sample-cm-track.json");
  const propsPath = path.join(ROOT, "var", "campaign-lab", "sample-cm-props.json");

  fs.writeFileSync(wavPath, wav);
  fs.writeFileSync(trackPath, JSON.stringify(track, null, 2) + "\n");
  fs.mkdirSync(path.dirname(propsPath), { recursive: true });
  fs.writeFileSync(
    propsPath,
    JSON.stringify(
      { kit: sampleCampaignKit, track, audioSrc: "sample-cm.wav" },
      null,
      2
    ) + "\n"
  );

  console.log(`\nwrote ${wavPath} (${(wav.length / 1024).toFixed(0)} KB)`);
  console.log(`wrote ${trackPath}`);
  console.log(`wrote ${propsPath} — render with: npm run campaign:render -- --sample`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
