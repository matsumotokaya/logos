// How this template sounds its structure — the audio sibling of delivery.ts.
//
// delivery.ts is the template's opinion about how its words are READ; this is
// its opinion about which moments RING. Same register, same justification: an
// event announcement marks its own structure — it begins, its title lands, its
// chapters turn, its speakers arrive, its close arrives — and marks nothing
// else. "やりすぎるとチープ" was the client's one-line brief for this layer,
// so two scenes are deliberately silent: the promise (fourteen seconds that
// want to be watched, not punctuated) and the end card (the film closes on
// music alone; a hit there reads as a stinger from another genre).
//
// **`presence` is not a volume.** The pool's files are mastered 10 dB apart,
// so a hand-picked volume per cue encodes the sample-maker's mastering as if
// it were a decision — measured on the Freehand Lab's first cut, where the
// opening clap arrived quieter than the chapter turns it outranks and the
// speakers' bell did not survive the narration at all (+25 RMS against +887).
// Each file is measured once at ingest (scripts/fetch-default-sfx.mjs →
// public/defaults/sfx/catalog.json, first-second mean → gain to −20 dB); the
// cue sheet only says how far forward a moment steps relative to the others.
//
// Levelling gets a file into range; it does not equalise instruments. A bell
// is diffuse where a woodblock is a transient, so 鈴 carries a higher presence
// than its role alone would suggest (measured: at equal presence it arrived at
// a third of every other cue's energy).

import type { EventCmSceneRole } from "@/remotion/event-cm/types";
import catalog from "@/public/defaults/sfx/catalog.json";

export interface SfxCue {
  /** Path under public/, for resolveSrc/staticFile. */
  src: string;
  /** Milliseconds after the scene starts. */
  atMs: number;
  /** Final multiplier: measured gain × editorial presence. Never hand-set. */
  volume: number;
}

type CatalogEntry = { src: string; gain: number };
const SOUNDS = (catalog as { sounds: Record<string, CatalogEntry> }).sounds;

/** How far forward a cue steps, 0–1, AFTER levelling. The film's scale, not
 *  the file's: only the opening plays against music alone. */
const PRESENCE = {
  opening: 0.5,
  title: 0.4,
  chapter: 0.45,
  arrival: 0.45,
  closing: 0.35,
} as const;

/**
 * One trim over the whole cue sheet — a listening judgment, not a measurement.
 *
 * The requester's note on the first watch with SFX in place: 「サウンド
 * エフェクトがちょっと大きいので今より70%ぐらいの音量でいい」. Applied here
 * rather than by scaling the five numbers above, because those say how far each
 * moment steps forward RELATIVE TO THE OTHERS and that ranking did not change —
 * only how loudly the whole layer sits under the music and the voice. Rewriting
 * them to 0.35 / 0.28 / 0.315 … would encode one global decision five times and
 * lose the record of why 鈴 outranks its role.
 */
const SFX_TRIM = 0.7;

const cue = (file: string, presence: number, atMs: number): SfxCue | null => {
  const entry = SOUNDS[file];
  // A file missing from the catalog is a pool problem, not a film problem:
  // the cue silently stands down rather than pointing Audio at a 404.
  if (!entry) return null;
  return {
    src: entry.src,
    atMs,
    volume: Number(Math.min(1, entry.gain * presence * SFX_TRIM).toFixed(3)),
  };
};

/**
 * The cue for one scene role, by identity — three programme pictures ring the
 * same bell on purpose (three different transitions read as three unrelated
 * films), and `index` stays a parameter so a template that wants to vary them
 * can.
 */
export function eventCmSfxCue(role: EventCmSceneRole, _index = 0): SfxCue | null {
  switch (role) {
    // 拍子木: the two wooden blocks that open a performance — the one moment
    // with no voice and no picture to compete with.
    case "logoIn":
      return cue("hyoushigi1.mp3", PRESENCE.opening, 450);
    // A single taiko as the title draws in, before the first narrated line.
    case "title":
      return cue("drum-japanese1.mp3", PRESENCE.title, 120);
    // The chapter turn rings the 鈴 (client call, 2026-08-18 — the synthetic
    // woosh sat wrong against an acoustic palette).
    case "program":
      return cue("bell1.mp3", PRESENCE.chapter, 0);
    // The same bell announces the speakers: people arriving and chapters
    // turning are the same kind of moment, and one instrument says so.
    case "guests":
      return cue("bell1.mp3", PRESENCE.arrival, 60);
    // 和太鼓のドドン under the date landing — the film's one two-beat hit,
    // saved for its biggest fact (client call; the koto glissando didn't sit).
    case "cta":
      return cue("drum-japanese2.mp3", PRESENCE.closing, 0);
    // value: watched, not punctuated. logoOut: music alone.
    default:
      return null;
  }
}
