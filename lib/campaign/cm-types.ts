// CM video data contracts shared by the server voice stage, the job store,
// the API routes, the Remotion composition and the Player UI. Plain types
// only — importable from server and client alike.

import type { CmScene } from "./schema";

/** One scene's slice of the mixed voice track (ms on the final timeline). */
export interface CmVoiceScene extends CmScene {
  startMs: number;
  durationMs: number;
}

/** Sentence-level caption timing (character-count proration within a scene). */
export interface CmCaption {
  text: string;
  startMs: number;
  endMs: number;
}

/** The voice artifact: everything the video renderer needs besides the WAV. */
export interface CmVoiceTrack {
  version: 1;
  generatedAt: string;
  totalMs: number;
  sampleRate: number;
  /** true when the audio is the keyless placeholder tone (CAMPAIGN_TTS_MOCK). */
  mock: boolean;
  provider: string;
  voice: string;
  scenes: CmVoiceScene[];
  captions: CmCaption[];
}

/** CM state stored on a campaign job (WAV/MP4 live next to the job file).
 *  `track` appears as soon as the voice stage finishes (the Player can start
 *  immediately) while `status` stays "running" through the MP4 render. */
export interface CampaignCmState {
  status: "running" | "done" | "error";
  error: string | null;
  track: CmVoiceTrack | null;
  /** true when <id>.cm.mp4 was rendered (local-first; false on hosts without
   *  Chromium — the browser Player still works, only the LP embed is absent). */
  mp4?: boolean;
}
