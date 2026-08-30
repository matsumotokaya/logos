import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { BrandKitSchema, type BrandKit } from "./schema";
import { describeThemesForPrompt } from "./themes";
import type { RawServiceInfo } from "./ingest";
import type { SiteCapture } from "./capture";
import { describeCandidates, type PaletteCandidate } from "./palette";
import { luminance } from "../color";
import { LLM_BUDGET, LLM_MODEL, parseOrExplain } from "@/lib/llm";

// Campaign creative — turn any mix of sources (scraped URL, pasted text,
// uploaded PDFs / images) into a validated Service Brand Kit via OpenAI
// structured outputs. NotebookLM-style: every source type funnels into the
// same generation stage.
//
// Tier S palette pipeline (see labs/campaign/docs/palette-accuracy.md):
// - adjudicatePalette (Stage 3): given screenshots + deterministic candidates,
//   the VLM assigns roles. Output colors are enum-constrained to the
//   candidate hexes, so invention is structurally impossible.
// - generateBrandKit: when an adjudicated palette exists it is injected as
//   fixed truth (palette_source: "extracted"); otherwise the palette is an AI
//   proposal (palette_source: "generated").
// - judgeBrandMatch (Stage 4): compare the rendered LP against the original
//   site screenshot and flag mismatches before shipping.


// Bound every LLM call so a stalled connection fails fast instead of hanging
// the (detached) generation job forever. The SDK default is 10 min × retries;
// a campaign stage that hasn't answered in 2 min is stuck, not slow.
const LLM_TIMEOUT_MS = 120_000;
const openai = (): OpenAI =>
  new OpenAI({ timeout: LLM_TIMEOUT_MS, maxRetries: 2 });

// Pricing (USD per 1M tokens) — for the cost line in the process log.
// GPT-5.6 family GA 2026-07-09: sol $5/$30, terra $2.50/$15, luna $1/$6.
// Update if the model or its pricing changes.
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-luna": { input: 1, output: 6 },
};

/** Token usage + estimated cost of one LLM API call. */
export interface LlmUsage {
  model: string;
  purpose: "palette-adjudication" | "brand-kit" | "brand-match";
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

function usageOf(
  response: {
    usage?: { prompt_tokens: number; completion_tokens: number } | null;
  },
  purpose: LlmUsage["purpose"],
): LlmUsage {
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const price = PRICE_PER_MTOK[LLM_MODEL] ?? { input: 0, output: 0 };
  return {
    model: LLM_MODEL,
    purpose,
    inputTokens,
    outputTokens,
    estimatedCostUsd:
      (inputTokens * price.input + outputTokens * price.output) / 1_000_000,
  };
}

/** Log-friendly rendering: 入力12,345 / 出力678トークン ≈ $0.08 */
export function formatUsage(u: {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}): string {
  return `入力${u.inputTokens.toLocaleString()} / 出力${u.outputTokens.toLocaleString()}トークン ≈ $${u.estimatedCostUsd.toFixed(3)}`;
}

export type SourceFile =
  | { kind: "pdf"; data: string }
  | {
      kind: "image";
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      data: string;
    };

export interface AdjudicatedPalette {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mode: "light" | "dark";
  rationale: string;
}

export interface CreativeInput {
  raw: RawServiceInfo | null;
  userName?: string;
  userDescription?: string;
  pastedText?: string;
  files: SourceFile[];
  /** Stage 3 result. When present, the palette is fixed — not the LLM's choice. */
  adjudicated?: AdjudicatedPalette | null;
  /** CSS-derived design hints from the rendered page (context for font_style etc.). */
  designTokens?: import("./schema").DesignTokens | null;
  /** Stage 4 feedback when regenerating after a failed verification. */
  feedback?: string;
}

const SYSTEM_PROMPT = `You are a senior brand designer and copywriter at a creative agency specializing in launch campaigns for new digital services.

Given raw information about a service (scraped page text, meta info, brand color hints, uploaded documents, screenshots), produce a complete Service Brand Kit.

Rules:
- All user-facing copy (headlines, descriptions, narration) must be in natural, punchy Japanese. Avoid literal-translation tone.
- organization is the real-world company, sole proprietor, nonprofit, or person operating the service. It is NOT the Logos account/workspace. Use footer text, legal notices, JSON-LD, and source documents as evidence. Never silently treat the service name as a legal company name when the operator is unknown; use relationship="unknown" and low confidence instead.
- classification decides where this subject belongs without asking the user. Use brand_kind="corporate" for the operator's own corporate identity, "business" for a broad line of business, "service" for a named service, "product" for an independently branded product, "media" for a publication/channel, and "event" only for a recurring event with its own durable logo, colors, and tone. Set placement="brand" only when the subject has a durable independent identity. Set placement="work" for a one-off seminar, campaign, launch, or an item that is merely part of a parent service. When uncertain, prefer placement="work" so the permanent Brand catalog is not polluted. Explain the evidence briefly in Japanese.
- Copy is benefit-driven: lead with what the audience gains, not feature lists.
- service.industry / business_type / offering / audience are ANALYSIS results, not marketing copy: state factually what kind of business this is and what it primarily provides, grounded in the source material.
- Colors: when the prompt provides an adjudicated palette extracted from the real site, reproduce it EXACTLY and set palette_source to "extracted". Never invent colors when evidence exists. Only when no palette evidence is provided may you propose a palette that fits the service genre and personality — in that case set palette_source to "generated". Ensure text/background contrast is readable (WCAG AA-ish).
- In hero / problem / features / how_it_works, never invent false claims (user counts, awards, pricing). Stay within what the source material supports; when unsure, write aspirational but non-factual copy.
- copy.proof / testimonials / pricing / faq are PLACEHOLDER sections: the page must always render a complete SaaS-style layout, so when the sources say nothing about them, write plausible fiction. Keep it clearly generic: fictional Japanese personas, coined brand names (never real companies), round plausible numbers. If the sources DO state real pricing or metrics, use those. The page labels these sections as sample content the owner will replace.
- theme: choose exactly ONE design theme id from the theme catalog in the prompt, matching the service's industry / business_type / brand personality. The theme drives the LP template and, later, the CM video / banners / BGM. Let the chosen theme's 方向性 guide the copy tone and narration voice. When palette_source is "generated", also let it guide the proposed palette — but a theme NEVER overrides an adjudicated (extracted) palette.
- cm_script: the ~30 second CM narration, split into exactly 5 scenes in this order: hook (grab the target audience, ~1 sentence), problem (voice the pains — echo copy.problem.points), solution (present the service by name as the answer), features (weave 2-3 benefits from copy.features into flowing speech, not a list), cta (end with the concrete next action, echoing the CTA label). Each scene's text is exactly the words a voice actor reads aloud — no headings, no directions. Total roughly 180-260 Japanese characters so it fits ~30 seconds.`;

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

function imagePart(mediaType: string, base64: string): ContentPart {
  return {
    type: "image_url",
    image_url: { url: `data:${mediaType};base64,${base64}` },
  };
}

export async function generateBrandKit(
  input: CreativeInput,
): Promise<{ kit: BrandKit; usage: LlmUsage }> {
  const client = openai();

  const content: ContentPart[] = [];
  for (const file of input.files.slice(0, 5)) {
    if (file.kind === "pdf") {
      content.push({
        type: "file",
        file: {
          filename: "source.pdf",
          file_data: `data:application/pdf;base64,${file.data}`,
        },
      });
    } else {
      content.push(imagePart(file.mediaType, file.data));
    }
  }
  content.push({ type: "text", text: buildUserPrompt(input) });

  const response = await parseOrExplain(() =>
    client.chat.completions.parse({
    model: LLM_MODEL,
    max_completion_tokens: LLM_BUDGET.long,
    reasoning_effort: "medium",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: zodResponseFormat(BrandKitSchema, "brand_kit"),
    }),
    "ソースが長さの上限に達しました。読み込むページを減らすか、短いソースでお試しください",
  );

  const kit = response.choices[0]?.message.parsed;
  if (!kit) {
    throw new Error("Brand Kit の生成に失敗しました（構造化出力なし）");
  }

  // Enforce the adjudicated palette structurally — the LLM was instructed to
  // reproduce it, but the pipeline does not rely on obedience.
  if (input.adjudicated) {
    const { primary, accent, background, surface, text, mode } =
      input.adjudicated;
    kit.brand = {
      ...kit.brand,
      primary,
      accent,
      background,
      surface,
      text,
      mode,
      palette_source: "extracted",
    };
  } else {
    kit.brand.palette_source = "generated";
  }
  return { kit, usage: usageOf(response, "brand-kit") };
}

function buildUserPrompt(input: CreativeInput): string {
  const parts: string[] = ["# Source material for the Brand Kit"];
  if (input.userName)
    parts.push(`Service name (user-provided): ${input.userName}`);
  if (input.userDescription)
    parts.push(`Service description (user-provided): ${input.userDescription}`);

  const raw = input.raw;
  if (raw) {
    parts.push(`URL: ${raw.url}`);
    if (raw.title) parts.push(`Page title: ${raw.title}`);
    if (raw.description) parts.push(`Meta description: ${raw.description}`);
    if (raw.themeColor) parts.push(`Theme color: ${raw.themeColor}`);
    if (raw.colorHints.length)
      parts.push(`Frequent colors on the page: ${raw.colorHints.join(", ")}`);
    if (raw.headings.length)
      parts.push(`Headings:\n${raw.headings.map((h) => `- ${h}`).join("\n")}`);
    if (raw.bodyText) parts.push(`Page text (truncated):\n${raw.bodyText}`);
    if (raw.footerText) parts.push(`Footer / legal text:\n${raw.footerText}`);
    if (raw.organizationHints.length) {
      parts.push(
        `Possible organization names found mechanically:\n${raw.organizationHints.map((name) => `- ${name}`).join("\n")}`,
      );
    }
  }
  if (input.pastedText) {
    parts.push(`Pasted source text:\n${input.pastedText.slice(0, 12_000)}`);
  }
  if (input.designTokens) {
    const t = input.designTokens;
    const lines = [
      t.body_font && `body font: ${t.body_font}`,
      t.heading_font && `heading font: ${t.heading_font}`,
      t.button_radius && `button radius: ${t.button_radius}`,
      t.section_spacing && `section vertical padding: ${t.section_spacing}`,
    ].filter(Boolean);
    if (lines.length)
      parts.push(
        `Design tokens observed on the rendered page (use as hints for font_style / tone):\n${lines.join("\n")}`,
      );
  }
  if (input.files.length) {
    parts.push(
      `The ${input.files.length} attached document(s)/image(s) above describe the service (flyers, decks, screenshots, key visuals). Use them for content, palette and tone.`,
    );
  }
  if (input.adjudicated) {
    const p = input.adjudicated;
    parts.push(
      [
        "# Adjudicated brand palette (extracted from the real site — use EXACTLY these values)",
        `primary: ${p.primary}`,
        `accent: ${p.accent}`,
        `background: ${p.background}`,
        `surface: ${p.surface}`,
        `text: ${p.text}`,
        `mode: ${p.mode}`,
        `rationale: ${p.rationale}`,
        'Set brand.palette_source to "extracted".',
      ].join("\n"),
    );
  } else {
    parts.push(
      'No palette evidence could be extracted from a rendered page. Propose a fitting palette and set brand.palette_source to "generated".',
    );
  }
  parts.push(describeThemesForPrompt());
  if (input.feedback) {
    parts.push(
      `# Reviewer feedback on the previous attempt (fix this)\n${input.feedback}`,
    );
  }
  parts.push("Produce the Service Brand Kit now.");
  return parts.join("\n\n");
}

// ---------- Stage 3: VLM palette adjudication ----------

const ADJUDICATOR_SYSTEM = `You are a meticulous brand-design auditor. You are shown screenshots of a real website plus a list of color candidates that were mechanically extracted from the rendered page, each with evidence (painted area share, gradient backgrounds, rendered-pixel share, og:image key-visual share, usage on buttons/links, CSS variable names, logo colors).

Assign palette roles by choosing ONLY from the candidate colors. Do not invent or adjust colors. Judge from what the screenshots actually show:
- background: the dominant page background
- text: the main body text color
- primary: the brand's main color (often the logo / heading / hero color)
- accent: a SECOND brand color, different from primary, used for emphasis. Look for a distinct hue in the hero / key visual / gradients / links / highlights — evidence lines like グラデーション背景, 画面ピクセル and キービジュアル mark exactly these. A hue that dominates the hero imagery is a legitimate brand color even if no button uses it. Reuse the primary ONLY when the site is truly monochromatic (no second hue anywhere in the screenshots).
- surface: card/section background slightly offset from the page background. If no distinct surface exists, reuse the background candidate closest to it. A pale tint of the hero hue is a good surface when the site uses one.
- mode: light or dark, from the overall page appearance

If the candidates clearly cannot represent the site's brand (e.g. screenshots failed to load, page is an error page), set assessment to "insufficient" and palette to null. Otherwise set assessment to "confident".`;

export async function adjudicatePalette(input: {
  capture: SiteCapture;
  candidates: PaletteCandidate[];
  /** Stage 4 reviewer feedback when re-adjudicating after a mismatch. */
  feedback?: string;
}): Promise<{ palette: AdjudicatedPalette | null; usage: LlmUsage | null }> {
  const hexes = input.candidates.map((c) => c.hex);
  if (hexes.length < 2) return { palette: null, usage: null };

  const HexEnum = z.enum(hexes as [string, ...string[]]);
  const AdjudicationSchema = z.object({
    assessment: z
      .enum(["confident", "insufficient"])
      .describe(
        '"insufficient" only when the candidates cannot represent the brand',
      ),
    palette: z
      .object({
        primary: HexEnum,
        accent: HexEnum,
        background: HexEnum,
        surface: HexEnum,
        text: HexEnum,
        mode: z.enum(["light", "dark"]),
      })
      .nullable()
      .describe("null only when assessment is insufficient"),
    rationale: z
      .string()
      .describe("1-3 sentences: why these roles, citing the evidence"),
  });

  const client = openai();
  const content: ContentPart[] = [];
  const shots: [string, string | null][] = [
    ["Desktop above-the-fold (1440px)", input.capture.screenshots.desktop],
    ["Full page (downscaled)", input.capture.screenshots.fullPage],
    ["Mobile (390px)", input.capture.screenshots.mobile],
  ];
  for (const [label, data] of shots) {
    if (!data) continue;
    content.push({ type: "text", text: label });
    content.push(imagePart("image/jpeg", data));
  }
  content.push({
    type: "text",
    text: `Candidate colors extracted from the rendered page:\n${describeCandidates(
      input.candidates,
    )}${
      input.feedback
        ? `\n\nReviewer feedback on the previous assignment (fix this):\n${input.feedback}`
        : ""
    }\n\nAssign the palette roles now.`,
  });

  const response = await client.chat.completions.parse({
    model: LLM_MODEL,
    max_completion_tokens: LLM_BUDGET.short,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: ADJUDICATOR_SYSTEM },
      { role: "user", content },
    ],
    response_format: zodResponseFormat(
      AdjudicationSchema,
      "palette_adjudication",
    ),
  });

  const usage = usageOf(response, "palette-adjudication");
  const out = response.choices[0]?.message.parsed;
  if (!out || out.assessment === "insufficient" || !out.palette)
    return { palette: null, usage };

  // Deterministic readability guard: cards render body text (var(--text)) on
  // var(--surface), so an unreadable surface pick must never ship. Quality is
  // guaranteed by code, not by the adjudicator's obedience.
  const palette = { ...out.palette };
  if (contrastRatio(palette.surface, palette.text) < 4.5) {
    palette.surface = palette.background;
  }
  return { palette: { ...palette, rationale: out.rationale }, usage };
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- Stage 4: self-verification ----------

export interface BrandMatchJudgment {
  verdict: "pass" | "palette_mismatch" | "tone_mismatch";
  reason: string;
}

const VERIFIER_SYSTEM = `You compare two screenshots: (1) the original website of a service, (2) a landing page that was auto-generated for the same service. Judge ONLY whether the generated page looks like it belongs to the same brand.

- palette_mismatch: the generated page uses colors that clearly do not belong to the original brand (e.g. original is white/blue, generated is green), OR a hue that visually dominates the original (e.g. a hero / key-visual background covering a large share of the screen) is entirely absent from the generated page
- tone_mismatch: colors are plausible but the overall mood (dark/light, loud/quiet) contradicts the original
- pass: a human would accept the generated page as the same brand

Layout and copy differences are expected and must NOT cause a failure.`;

export async function judgeBrandMatch(input: {
  originalShot: string; // base64 jpeg
  generatedShot: string; // base64 jpeg
}): Promise<{ judgment: BrandMatchJudgment; usage: LlmUsage }> {
  const JudgmentSchema = z.object({
    verdict: z.enum(["pass", "palette_mismatch", "tone_mismatch"]),
    reason: z.string().describe("1-2 sentences in Japanese"),
  });

  const client = openai();
  const response = await client.chat.completions.parse({
    model: LLM_MODEL,
    max_completion_tokens: LLM_BUDGET.short,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: VERIFIER_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Original site:" },
          imagePart("image/jpeg", input.originalShot),
          { type: "text", text: "Generated landing page:" },
          imagePart("image/jpeg", input.generatedShot),
          { type: "text", text: "Judge now." },
        ],
      },
    ],
    response_format: zodResponseFormat(JudgmentSchema, "brand_match_judgment"),
  });

  return {
    judgment: response.choices[0]?.message.parsed ?? {
      verdict: "pass",
      reason: "判定結果を取得できず既定でpass",
    },
    usage: usageOf(response, "brand-match"),
  };
}
