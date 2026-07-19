import { z } from "zod";

// Service Brand Kit — the intermediate representation of Campaign Lab.
// Produced once from minimal inputs (URL / files / pasted text), then
// consumed by every renderer: LP, promo video (CM), SNS assets.
// Ported from the cm-maker Phase 0 pipeline.

export const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "hex color like #ff7a18");

export const BrandSchema = z.object({
  primary: HexColor.describe("Primary brand color"),
  accent: HexColor.describe("Accent color, contrasting with primary"),
  background: HexColor.describe("Page background color"),
  surface: HexColor.describe("Card/surface color, slightly offset from background"),
  text: HexColor.describe("Main text color, readable on background"),
  mode: z.enum(["light", "dark"]).describe("Overall theme mode"),
  font_style: z
    .enum(["modern-sans", "elegant-serif", "tech-mono", "rounded-friendly"])
    .describe("Typography direction matching the service personality"),
});

export const FeatureSchema = z.object({
  title: z.string().describe("Short feature name (<= 20 chars in Japanese)"),
  description: z.string().describe("1-2 sentence benefit-oriented description"),
  emoji: z.string().describe("Single emoji representing this feature"),
});

export const StepSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const CopySchema = z.object({
  hero: z.object({
    headline: z.string().describe("Punchy headline, <= 30 chars in Japanese"),
    subheadline: z.string().describe("1-2 sentences expanding the value proposition"),
    cta_label: z.string().describe("CTA button label, e.g. 無料で始める"),
  }),
  problem: z.object({
    headline: z.string().describe("Headline naming the pain the audience feels"),
    points: z.array(z.string()).min(2).max(4).describe("Concrete pain points"),
  }),
  features: z.array(FeatureSchema).min(3).max(4),
  how_it_works: z.object({
    headline: z.string(),
    steps: z.array(StepSchema).min(2).max(4),
  }),
  closing: z.object({
    headline: z.string().describe("Final push headline"),
    subtext: z.string(),
    cta_label: z.string(),
  }),
});

export const BrandKitSchema = z.object({
  service: z.object({
    name: z.string(),
    tagline: z.string().describe("<= 25 chars, appears next to the logo"),
    description: z.string().describe("2-3 sentence neutral description of the service"),
    genre: z
      .enum(["saas", "app", "ecommerce", "media", "community", "tool", "other"])
      .describe("Service category, used for template/BGM selection"),
    audience: z.string().describe("Primary target audience in one phrase"),
    url: z.string().nullable().describe("Service URL if known, else null"),
  }),
  brand: BrandSchema,
  copy: CopySchema,
  narration: z
    .string()
    .describe(
      "30-second CM narration script in Japanese. Spoken words only — no stage directions, no markdown. Flows: hook, problem, solution, features, CTA."
    ),
});

export type BrandKit = z.infer<typeof BrandKitSchema>;
export type Brand = z.infer<typeof BrandSchema>;
