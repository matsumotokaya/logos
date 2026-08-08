import assert from "node:assert/strict";
import test from "node:test";
import { mergeProfile, profileFromKnowledge } from "./knowledge";

test("BrandKnowledgeを既存UI互換のprofileへ投影する", () => {
  assert.deepEqual(
    profileFromKnowledge([
      { field_path: "offering.name", value: "Logos" },
      { field_path: "palette.primary", value: "#112233" },
      { field_path: "typography.heading_font", value: "Inter" },
      { field_path: "tone.theme", value: "tech-glass" },
    ]),
    {
      service: { name: "Logos" },
      palette: { primary: "#112233" },
      design_tokens: { heading_font: "Inter" },
      theme: "tech-glass",
    },
  );
});

test("Knowledgeの確定値がlegacy profileの同じフィールドだけを上書きする", () => {
  assert.deepEqual(
    mergeProfile(
      { palette: { primary: "#000000", accent: "#ffffff" }, extra: true },
      { palette: { primary: "#123456" } },
    ),
    { palette: { primary: "#123456", accent: "#ffffff" }, extra: true },
  );
});
