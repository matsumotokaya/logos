import { z } from "zod";
import { CAMPAIGN_THEME_IDS } from "./themes";

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
  palette_source: z
    .enum(["extracted", "generated"])
    .describe(
      "'extracted' when every color was chosen from evidence collected on the real site; 'generated' when the palette is an AI proposal without site evidence"
    ),
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

// Placeholder-friendly sections: a full SaaS-style sales page needs social
// proof, testimonials, pricing and FAQ even when the sources say nothing
// about them. These are generated as PLAUSIBLE FICTION (clearly generic, no
// real company names) and the renderer labels them as sample content the
// user should replace — the input-completion philosophy: scraped/generated
// values are 仮情報 that the user later overwrites with facts.

export const StatSchema = z.object({
  value: z.string().describe('Short display value, e.g. "3分", "92%", "500+"'),
  label: z.string().describe("What the value measures, <= 12 chars in Japanese"),
});

export const TestimonialSchema = z.object({
  quote: z.string().describe("1-2 sentence customer quote in Japanese"),
  name: z.string().describe('Fictional Japanese name, e.g. "田中 美咲"'),
  role: z
    .string()
    .describe('Fictional role + company type, e.g. "マーケティング責任者 / SaaS企業"'),
});

export const PricingPlanSchema = z.object({
  name: z.string().describe('Plan name, e.g. "Free", "Pro"'),
  price: z.string().describe('Display price, e.g. "¥0", "¥9,800"'),
  period: z.string().describe('Billing period suffix, e.g. "/月". Empty string if none'),
  description: z.string().describe("One sentence: who this plan is for"),
  features: z.array(z.string()).min(3).max(5),
  highlighted: z.boolean().describe("true for exactly one recommended plan"),
  cta_label: z.string(),
});

export const FaqItemSchema = z.object({
  q: z.string(),
  a: z.string().describe("2-3 sentence answer, reassuring tone"),
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
  proof: z.object({
    stats: z
      .array(StatSchema)
      .min(3)
      .max(3)
      .describe("3 headline metrics. Plausible fiction when sources have none"),
    client_names: z
      .array(z.string())
      .min(4)
      .max(6)
      .describe(
        "Fictional client/brand names for the logo row (katakana or English coined words, never real companies)"
      ),
  }),
  testimonials: z.array(TestimonialSchema).min(2).max(3),
  pricing: z.object({
    headline: z.string().describe('e.g. "シンプルな料金プラン"'),
    plans: z.array(PricingPlanSchema).min(2).max(3),
  }),
  faq: z.array(FaqItemSchema).min(3).max(5),
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
    industry: z
      .string()
      .describe(
        "業種・産業を日本語の一言で (e.g. 不動産テック, 生成AI基盤, 飲食（カフェ）, 会計SaaS)"
      ),
    business_type: z
      .enum([
        "saas",
        "app",
        "web_service",
        "ecommerce",
        "media",
        "consulting",
        "agency",
        "restaurant",
        "retail",
        "local_service",
        "freelance",
        "community",
        "tool",
        "other",
      ])
      .describe(
        "What kind of business this is — used for template/BGM selection. saas=B2B/B2C SaaS, app=consumer app, consulting=advisory, agency=client-work studio, restaurant/retail/local_service=physical business, freelance=individual professional"
      ),
    offering: z
      .string()
      .describe("主に何を提供しているか、1文の日本語で (analysis result, not marketing copy)"),
    audience: z.string().describe("Primary target audience in one phrase"),
    url: z.string().nullable().describe("Service URL if known, else null"),
  }),
  theme: z
    .enum(CAMPAIGN_THEME_IDS)
    .describe(
      "Design theme id for ALL renderers (LP / video / banners). Choose from the theme catalog in the prompt by industry, business_type and brand personality. Stored on the kit so it can be changed later."
    ),
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

// ---------- deterministic parts merged in by the pipeline (not LLM output) ----------

/** Visual assets collected from the real site (Stage 1 capture / ingest). */
export interface BrandAssets {
  /** Header logo element screenshot (or favicon fallback), base64 PNG. */
  logo: { data: string; media_type: "image/png" } | null;
  /** Inline-SVG logo with computed fills baked in (vector master), when the
   *  site's logo was an inline <svg>. Absent on records from before 2026-07-20. */
  logo_svg?: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  source_url: string | null;
}

/** Best-effort design guideline hints read from computed CSS. */
export interface DesignTokens {
  body_font: string | null;
  heading_font: string | null;
  button_radius: string | null;
  button_padding: string | null;
  /** typical vertical padding of top-level sections (余白のルールの近似) */
  section_spacing: string | null;
  container_width: string | null;
}

/** The full portable artifact: LLM-generated kit + deterministic evidence. */
export type CampaignBrandKit = Omit<BrandKit, "theme"> & {
  /** Absent on kits stored before themes existed; resolveTheme() falls back. */
  theme?: BrandKit["theme"];
  assets: BrandAssets | null;
  design_tokens: DesignTokens | null;
};
