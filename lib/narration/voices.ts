// The voices a narration can be read in.
//
// Gemini's TTS ships about thirty prebuilt voices, catalogued by CHARACTER
// ("Informative", "Upbeat", "Firm", "Even") and not by gender. Thirty star
// names is not a choice anybody can make, so this is a short shortlist: the
// voice the template has always used, plus two that read male and two that read
// female, each picked for a delivery an announcement can carry.
//
// **The gender labels are ours, not Google's.** The catalog does not state
// gender, and nothing here has been verified by ear. They exist because
// 「男性1 / 女性1」 is the choice a user actually wants to make; a row that turns
// out wrong is one line to fix in this table, which is why the Gemini name and
// the documented character travel with it on screen.

export interface NarrationVoice {
  /** Stable id stored in the take's voice track. */
  id: string;
  label: string;
  /** Gemini prebuilt voice name. */
  voice: string;
  /** Google's own one-word description of this voice. */
  character: string;
  /** What it is for, in this template's terms. */
  note: string;
}

export const NARRATION_VOICES: readonly NarrationVoice[] = [
  {
    id: "standard",
    label: "標準",
    voice: "Schedar",
    character: "Even",
    note: "起伏を抑えた読み。これまでの声",
  },
  {
    id: "male-1",
    label: "男性1",
    voice: "Charon",
    character: "Informative",
    note: "説明が通る低め。告知向け",
  },
  { id: "male-2", label: "男性2", voice: "Puck", character: "Upbeat", note: "前に出る明るさ" },
  { id: "female-1", label: "女性1", voice: "Kore", character: "Firm", note: "芯のある読み" },
  {
    id: "female-2",
    label: "女性2",
    voice: "Aoede",
    character: "Breezy",
    note: "軽やかで風通しのよい読み",
  },
] as const;

export const DEFAULT_NARRATION_VOICE = NARRATION_VOICES[0];

export const narrationVoiceById = (id: string | null | undefined) =>
  NARRATION_VOICES.find((entry) => entry.id === id);

/** Which preset a recorded track came from, matched by the Gemini voice name —
 *  tracks recorded before presets existed still resolve to one. */
export const narrationVoiceByName = (name: string | null | undefined) =>
  NARRATION_VOICES.find((entry) => entry.voice === name);
