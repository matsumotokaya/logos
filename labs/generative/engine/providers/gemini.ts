// Vertex AI — Gemini 3 Pro Image: the art-director layer (対話修正層).
// Multi-turn editing (ラフ→修正→ムード微調整, up to 14 input images) lands
// with Phase E3's generation sessions (E-7). Until then this is a declared
// stub so the engine constellation is visible in the catalog from day one.

import type { Provider } from "./types";

export const geminiProvider: Provider = {
  id: "gemini",
  name: "Gemini 3 Pro Image (Vertex AI)",
  roleJa: "対話修正層(アートディレクター): マルチターン編集",
  costPerImageUsd: 0,
  notesJa: "Phase E3(マルチターンセッション)で統合予定。IP補償のあるVertex AI経由",
  available: () => false,
  generate: async () => {
    throw new Error("Gemini対話修正層は Phase E3 で統合予定(未接続)");
  },
};
