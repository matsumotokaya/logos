import "server-only";

// Stage 5 (voice) for product-cm: take the Service Brand Kit's structured CM
// script and speak it.
//
// The speaking itself lives in lib/narration/voice.ts, shared with every other
// narrated template. What stays here is what is genuinely product-cm's: where
// the script comes from (the Kit), and how its narrator should sound.
//
// Set CAMPAIGN_TTS_MOCK=1 to develop without a GEMINI_API_KEY (placeholder
// tone, real timings).

import {
  generateNarration,
  narrationVoiceAvailable,
} from "@/lib/narration/voice";
import type { CampaignBrandKit } from "./schema";
import type { CmVoiceTrack } from "./cm-types";

const TTS_PERSONA =
  "明るく信頼感のあるCMナレーター。テンポよく、聞き取りやすく読み上げます。";

export function cmVoiceAvailable(): boolean {
  return narrationVoiceAvailable();
}

export async function generateCmVoice(
  kit: CampaignBrandKit,
  onProgress?: (message: string, level?: "info" | "success" | "warn") => void
): Promise<{ wav: Buffer; track: CmVoiceTrack }> {
  const scenes = kit.cm_script;
  if (!scenes || scenes.length === 0) {
    throw new Error(
      "このキャンペーンには構造化CMスクリプトがありません。再生成すると動画素材を作成できます。"
    );
  }

  return generateNarration(scenes, { persona: TTS_PERSONA, onProgress });
}
