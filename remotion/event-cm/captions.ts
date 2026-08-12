import { eventCmTimeline } from "./timeline";
import { EVENT_CM_SCENE_ROLES, type EventCmBrief } from "./types";

// Subtitles.
//
// Not optional, and not a feature of the voice. Business video is watched
// muted — a film whose words only exist as audio says nothing to most of the
// people who see it. So subtitles are derived from whatever is known, on the
// same three-stage principle as the timeline (timeline.ts):
//
//   script written  → the sentences, timed by character weight
//   voice recorded  → the sentences, timed by the measured track
//
// Deriving from the script is the part that matters. Reading the voice track's
// own captions would be simpler, and would mean no subtitles until somebody
// paid for TTS — which is exactly backwards for the reason subtitles exist.
//
// Sentence-level, not scene-level: a beat runs eight to twelve seconds and
// carries fifty characters, which is a paragraph on screen. Sentences give
// two-to-four second cards of fifteen to twenty-five characters, which is what
// commercial subtitles actually are, and the narration is already written so
// its sentences break where a reader would breathe.

export interface Caption {
  text: string;
  fromMs: number;
  toMs: number;
}

/** Split on Japanese sentence endings, keeping the delimiter with its clause. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。．！？!?])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

const weightOf = (text: string): number => Math.max(1, text.replace(/\s/g, "").length);

export function captionsFor(brief: EventCmBrief): Caption[] {
  const scenes = brief.script.scenes;
  if (scenes.length !== EVENT_CM_SCENE_ROLES.length) return [];

  const timeline = eventCmTimeline(brief);
  const captions: Caption[] = [];

  for (const [index, scene] of scenes.entries()) {
    const timing = timeline.scenes[index];
    if (!timing) continue;

    // The opening scene holds the music's lead-in, during which nobody is
    // speaking — so its subtitles start where the narration does.
    const startMs = index === 0 ? timeline.narrationStartMs : timing.fromMs;
    const endMs = timing.fromMs + timing.durationMs;
    const available = Math.max(1, endMs - startMs);

    const sentences = splitSentences(scene.text);
    if (sentences.length === 0) continue;

    const total = sentences.reduce((sum, sentence) => sum + weightOf(sentence), 0);
    let cursor = startMs;
    for (const [i, sentence] of sentences.entries()) {
      const share = Math.round((weightOf(sentence) / total) * available);
      // The last sentence absorbs the rounding, so subtitles always end
      // exactly where their scene does rather than a few frames short.
      const toMs = i === sentences.length - 1 ? endMs : cursor + share;
      captions.push({ text: sentence, fromMs: cursor, toMs });
      cursor = toMs;
    }
  }

  return captions;
}

/** The caption showing at a given moment, if any. */
export const captionAt = (captions: Caption[], ms: number): Caption | null =>
  captions.find((caption) => ms >= caption.fromMs && ms < caption.toMs) ?? null;
