import "server-only";

// Stage 5 (voice): structured CM script -> TTS per scene -> one mixed voice
// track + timing metadata. Scene boundaries fall out of the mix (one scene =
// one TTS section), sentence captions are prorated by character weight —
// both via the WKFL tts-lib this repo vendors in labs/campaign/audio/.
//
// No BGM yet (licensing is an open item, labs/campaign/docs §6); mixEpisode
// is called with bgm=null so ffmpeg is not required. Set CAMPAIGN_TTS_MOCK=1
// to develop without a GEMINI_API_KEY (placeholder tone, real timings).

import { synthesizeSection } from "../../labs/campaign/audio/tts-lib/tts.mjs";
import {
  parseUtterances,
  speechText,
  buildTimingJson,
} from "../../labs/campaign/audio/tts-lib/timing.mjs";
import {
  int16ToF32,
  injectIntervals,
  mixEpisode,
  encodeWav16,
} from "../../labs/campaign/audio/tts-lib/audio.mjs";
import type { CampaignBrandKit } from "./schema";
import type { CmVoiceTrack } from "./cm-types";

const TTS_PROVIDER = "gemini";
const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const TTS_VOICE = "Schedar"; // even delivery — the default CM narrator
const TTS_PERSONA =
  "明るく信頼感のあるCMナレーター。テンポよく、聞き取りやすく読み上げます。";
const MIX_SAMPLE_RATE = 24000; // Gemini TTS native rate; no resampling needed

export function cmVoiceAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) || process.env.CAMPAIGN_TTS_MOCK === "1";
}

export async function generateCmVoice(
  kit: CampaignBrandKit,
  onProgress?: (message: string, level?: "info" | "success" | "warn") => void
): Promise<{ wav: Buffer; track: CmVoiceTrack }> {
  const progress = (message: string, level: "info" | "success" | "warn" = "info") =>
    onProgress?.(message, level);

  const scenes = kit.cm_script;
  if (!scenes || scenes.length === 0) {
    throw new Error(
      "このキャンペーンには構造化CMスクリプトがありません。再生成すると動画素材を作成できます。"
    );
  }

  const mock = process.env.CAMPAIGN_TTS_MOCK === "1";
  if (mock) progress("開発用の音声を使用しています", "warn");

  const sections: { f32: Float32Array; sampleRate: number }[] = [];
  for (const [i, scene] of scenes.entries()) {
    progress(`シーン${i + 1}/${scenes.length}のナレーションを作成中…`);
    const { pcm, sampleRate } = await synthesizeSection({
      text: speechText(scene.text),
      voice: TTS_VOICE,
      persona: TTS_PERSONA,
      model: TTS_MODEL,
      provider: TTS_PROVIDER,
      apiKey: process.env.GEMINI_API_KEY,
    });
    const f32 = injectIntervals(
      int16ToF32(pcm),
      sampleRate,
      parseUtterances(scene.text)
    );
    sections.push({ f32, sampleRate });
  }

  const mix = mixEpisode(sections, null, {
    sampleRate: MIX_SAMPLE_RATE,
    introDelaySec: 0,
    sectionGapSec: 0.4,
    outroDelaySec: 0.8,
    fadeOutSec: 0,
    bgmVolume: 0,
    bgmMaxRatio: 0,
    duckRatio: 0,
  });

  const wav = encodeWav16([mix.L], MIX_SAMPLE_RATE); // mono voice track

  const timing = buildTimingJson(
    scenes.map((s) => s.text),
    mix.sectionStartsMs,
    mix.sectionDurationsMs
  ) as { id: string; start_ms: number; text: string }[];

  const track: CmVoiceTrack = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalMs: mix.totalMs,
    sampleRate: MIX_SAMPLE_RATE,
    mock,
    provider: TTS_PROVIDER,
    voice: TTS_VOICE,
    scenes: scenes.map((scene, i) => ({
      ...scene,
      startMs: mix.sectionStartsMs[i],
      durationMs: mix.sectionDurationsMs[i],
    })),
    captions: timing.map((t, i) => ({
      text: t.text,
      startMs: t.start_ms,
      endMs: timing[i + 1]?.start_ms ?? mix.totalMs,
    })),
  };

  progress(
    "ナレーションが完成しました",
    "success"
  );

  return { wav, track };
}
