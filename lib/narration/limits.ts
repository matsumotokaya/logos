// Limits the narration has to respect, shared by the browser and the server.
//
// Separate from lib/narration/voice.ts because that module is `server-only`
// (it reaches the TTS provider), and the editor needs the same number to tell
// somebody their line is too long BEFORE they ask for it to be read.

/** The provider's per-request ceiling (labs/campaign/audio/tts-lib/tts.mjs). */
export const TTS_MAX_SECTION_CHARS = 2000;
