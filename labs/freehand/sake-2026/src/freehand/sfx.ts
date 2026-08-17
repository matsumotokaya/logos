// Sound effects: where, how present, and — mostly — where not.
//
// The brief for this layer is one sentence from the client: "やりすぎるとチープ".
// So the rule is the same one the gold follows in this art direction: a sound
// means SOMEBODY DECIDED. It marks structure — the film opening, the title
// landing, a chapter turning, the speakers arriving, the close beginning —
// and nothing else. Six cues in 108 seconds.
//
// Deliberately silent:
//   value    the promise runs 14 seconds and wants to be watched, not punctuated
//   logoOut  the film should end on music alone; a hit on the end card reads as
//            a stinger from a different genre
//
// Four of the ten supplied effects are unused (時代劇演出, タイトル表示,
// ピアノの単音, 和太鼓でドドン). Not an oversight: 時代劇 and ドドン are period-
// drama loud for a corporate invitation, ピアノ is the wrong instrument family
// for 和モダン, and タイトル表示 does the same job as the taiko but sweeter.
// Kept in the folder so the choice can be revisited by ear.
//
// **`presence` is not a volume.** The supplied files are 10 dB apart from each
// other, so a hand-picked volume per cue encodes the mastering of whoever made
// the sample rather than a decision about the film. The first cut did exactly
// that and measured backwards: the opening clap landed quieter than the chapter
// transitions, and the bell for the speakers did not survive the narration at
// all (+25 RMS against +887, differencing the v2 and v3 renders). So each file
// is measured once (scripts/measure-sfx.mjs → sfx-levels.json), and what this
// sheet chooses is how PRESENT a cue should feel relative to the others.

import type { EventCmSceneRole } from "@/remotion/event-cm/types";
import levels from "./sfx-levels.json";

export interface SfxCue {
  src: string;
  /** Milliseconds after the scene starts. */
  atMs: number;
  /** The final multiplier, measured × editorial. Do not set by hand. */
  volume: number;
  why: string;
}

/** Measured normalisation for one file. Unknown files pass through at 1. */
const gainOf = (file: string): number =>
  (levels as Record<string, { gain: number }>)[file]?.gain ?? 1;

/**
 * How present a cue should feel, 0–1, AFTER levelling.
 *
 * The scale is the film's, not the file's: 1.0 is "this is the loudest thing
 * that happens", and the opening clap is the only cue near it because it plays
 * against music alone. Everything else competes with narration.
 */
const PRESENCE = {
  /** Against music only, and it is the film starting. */
  opening: 0.5,
  /** Under the title, just before the first line of narration. */
  title: 0.4,
  /** A chapter mark. Must be heard over a voice, must not interrupt it. */
  chapter: 0.3,
  /**
   * A person arriving. Same job as the chapter mark, gentler instrument.
   *
   * Higher than it looks because levelling normalises the first second, and a
   * bell is diffuse where a woodblock is a transient: at parity by that measure
   * the 鈴 still arrived at a third of every other cue's energy (465 RMS
   * against 1463–2342, measured on the v4 render). Levelling gets a file into
   * range; it does not equalise instruments.
   */
  arrival: 0.45,
  /** The close beginning. A phrase rather than a hit, so it sits lower. */
  closing: 0.3,
} as const;

const cue = (
  file: string,
  presence: number,
  atMs: number,
  why: string,
): SfxCue => ({
  src: `assets/sfx/${file}`,
  atMs,
  // Clamped because levelling multiplies: 拍子木 needs 1.8× to reach the
  // reference, and a presence chosen without that in mind would ask for more
  // than unity and clip against the music it is layered over.
  volume: Number(Math.min(1, gainOf(file) * presence).toFixed(3)),
  why,
});

/**
 * Cues by scene role. `program` takes an index so the three agenda pictures can
 * differ — they do not today (the same chapter mark three times is what makes
 * them read as one series), but the shape allows it.
 */
export const SFX: Partial<Record<EventCmSceneRole, (index: number) => SfxCue | null>> = {
  // 拍子木: the two wooden blocks that open a performance. Nothing else in the
  // supplied set says "it begins" as plainly, and the opening is the one moment
  // with no voice and no picture to compete with.
  logoIn: () => cue("hyoshigi.mp3", PRESENCE.opening, 450, "開幕の合図。ロゴが現れる瞬間"),
  // A single taiko under the vertical title as it draws in — placed before the
  // first line of narration so the two do not fight.
  title: () => cue("taiko-don.mp3", PRESENCE.title, 120, "タイトルが立ち上がる瞬間"),
  // The chapter turn. Same sound all three times on purpose: three different
  // transitions read as three unrelated films.
  program: () => cue("transition.mp3", PRESENCE.chapter, 0, "章が変わる"),
  // 鈴 for the speakers — the client's own example ("登壇者の紹介の時にちょっと
  // した効果音"). A bell announces a person without dramatising them.
  guests: () => cue("suzu.mp3", PRESENCE.arrival, 60, "登壇者が現れる"),
  // 琴の滑奏 runs 3.4s and carries the film into its last chapter, under the
  // date landing. The only cue that is a phrase rather than a hit.
  cta: () => cue("koto-glissando.mp3", PRESENCE.closing, 0, "締めへ入る"),
};

export const cueFor = (role: EventCmSceneRole, index = 0): SfxCue | null =>
  SFX[role]?.(index) ?? null;
