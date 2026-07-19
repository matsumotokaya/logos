import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BrandKitSchema, type BrandKit } from "./schema";
import type { RawServiceInfo } from "./ingest";

// Campaign creative — turn any mix of sources (scraped URL, pasted text,
// uploaded PDFs / images) into a validated Service Brand Kit via Claude
// structured outputs. NotebookLM-style: every source type funnels into the
// same generation stage.

export type SourceFile =
  | { kind: "pdf"; data: string }
  | {
      kind: "image";
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      data: string;
    };

export interface CreativeInput {
  raw: RawServiceInfo | null;
  userName?: string;
  userDescription?: string;
  pastedText?: string;
  files: SourceFile[];
}

const SYSTEM_PROMPT = `You are a senior brand designer and copywriter at a creative agency specializing in launch campaigns for new digital services.

Given raw information about a service (scraped page text, meta info, brand color hints, uploaded documents, screenshots), produce a complete Service Brand Kit.

Rules:
- All user-facing copy (headlines, descriptions, narration) must be in natural, punchy Japanese. Avoid literal-translation tone.
- Copy is benefit-driven: lead with what the audience gains, not feature lists.
- Colors: if color hints or images suggest an existing brand palette, honor it. Otherwise choose a palette that fits the service genre and personality. Ensure text/background contrast is readable (WCAG AA-ish).
- Never invent false claims (user counts, awards, pricing). Stay within what the source material supports; when unsure, write aspirational but non-factual copy.
- narration: exactly the words a voice actor reads aloud for a ~30 second CM (roughly 180-260 Japanese characters). No headings, no directions.`;

export async function generateBrandKit(input: CreativeInput): Promise<BrandKit> {
  const client = new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [];
  for (const file of input.files.slice(0, 5)) {
    if (file.kind === "pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: file.mediaType, data: file.data },
      });
    }
  }
  content.push({ type: "text", text: buildUserPrompt(input) });

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(BrandKitSchema) },
  });

  const kit = response.parsed_output;
  if (!kit) {
    throw new Error("Brand Kit の生成に失敗しました（構造化出力なし）");
  }
  return kit;
}

function buildUserPrompt(input: CreativeInput): string {
  const parts: string[] = ["# Source material for the Brand Kit"];
  if (input.userName) parts.push(`Service name (user-provided): ${input.userName}`);
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
  }
  if (input.pastedText) {
    parts.push(`Pasted source text:\n${input.pastedText.slice(0, 12_000)}`);
  }
  if (input.files.length) {
    parts.push(
      `The ${input.files.length} attached document(s)/image(s) above describe the service (flyers, decks, screenshots, key visuals). Use them for content, palette and tone.`
    );
  }
  parts.push("Produce the Service Brand Kit now.");
  return parts.join("\n\n");
}
