import { eventCmTimeline } from "./timeline";
import { eventCmSceneKey, type EventCmBrief } from "./types";

// Subtitles.
//
// Not optional, and not a feature of the voice. Business video is watched
// muted — a film whose words only exist as audio says nothing to most of the
// people who see it. So subtitles are derived from whatever is known, on the
// same three-stage principle as the timeline (timeline.ts):
//
//   scenario written  → the sentences, timed by character weight
//   voice recorded    → the sentences, timed by the measured track
//
// Deriving from the scenario is the part that matters. Reading the voice track's
// own captions would be simpler, and would mean no subtitles until somebody
// paid for TTS — which is exactly backwards for the reason subtitles exist.
//
// Sentence-level, not scene-level: a beat runs five to eight seconds and
// carries forty characters, which is a paragraph on screen. Sentences give
// two-to-four second cards of fifteen to twenty-five characters, which is what
// commercial subtitles actually are, and the narration is already written so
// its sentences break where a reader would breathe.
//
// Bounded by their own scene. One message per picture means a subtitle never
// runs across a cut, so a reader is never shown a line whose picture has
// already gone.

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

/**
 * The longest a single subtitle card may be.
 *
 * Commercial subtitles are fifteen to twenty-five characters on screen for two
 * to four seconds. A sentence is normally already that, which is why splitting
 * on 。 is the primary rule — but a *sentence* is not guaranteed to be a card.
 * Somebody writing their own line can type two hundred characters without a
 * full stop, and the band has no line limit: the plate simply grows until it
 * covers the picture it was supposed to subtitle.
 */
const MAX_CARD_CHARS = 28;

/**
 * One sentence as one or more cards.
 *
 * Breaks at 、 first, because that is where a reader would pause anyway, and
 * only slices mid-phrase when a run has no punctuation at all to break on.
 */
export function splitCards(sentence: string): string[] {
  if (weightOf(sentence) <= MAX_CARD_CHARS) return [sentence];

  const clauses = sentence
    .split(/(?<=[、,])/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const cards: string[] = [];
  let current = "";
  const flush = () => {
    if (current) cards.push(current);
    current = "";
  };

  for (const clause of clauses) {
    if (weightOf(clause) > MAX_CARD_CHARS) {
      flush();
      // Nothing to break on: cut it into card-sized runs rather than let one
      // card grow past the frame.
      for (let at = 0; at < clause.length; at += MAX_CARD_CHARS) {
        cards.push(clause.slice(at, at + MAX_CARD_CHARS));
      }
      continue;
    }
    if (weightOf(current) + weightOf(clause) > MAX_CARD_CHARS) flush();
    current += clause;
  }
  flush();
  return cards.length > 0 ? cards : [sentence];
}

const weightOf = (text: string): number => Math.max(1, text.replace(/\s/g, "").length);


export function captionsFor(brief: EventCmBrief): Caption[] {
  const timeline = eventCmTimeline(brief);
  // By scene identity: with three programme pictures, keying by role would time
  // every one of them against the first.
  const timingOf = new Map(
    timeline.scenes.map((scene) => [eventCmSceneKey(scene), scene]),
  );
  const captions: Caption[] = [];

  // One line per picture, so a scene's subtitles are bounded by that scene.
  // Nothing spans a cut, and the silent opening and close carry no text at all.
  for (const scene of brief.scenario.scenes) {
    const timing = timingOf.get(eventCmSceneKey(scene));
    if (!timing) continue;

    const startMs = timing.fromMs;
    const endMs = timing.fromMs + timing.durationMs;
    const available = Math.max(1, endMs - startMs);

    const sentences = splitSentences(scene.text).flatMap(splitCards);
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
