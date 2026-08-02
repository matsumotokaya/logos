import "server-only";

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { RawServiceInfo } from "@/lib/campaign/ingest";

const MODEL = "gpt-5.6-luna";
const TIMEOUT_MS = 60_000;

const OrganizationFactsSchema = z.object({
  name: z.string().max(160).describe("企業・団体・個人事業など、運営主体の名称。特定不能なら空文字"),
  organizationKind: z.enum(["company", "individual", "nonprofit", "other"]),
  industry: z.string().max(160).describe("主な業種を日本語の短い語句で。根拠不足なら空文字"),
  location: z.string().max(240).describe("本社・主所在地を日本語で。根拠不足なら空文字"),
});

export type InferredOrganizationFacts = z.infer<typeof OrganizationFactsSchema>;

const SYSTEM_PROMPT = `あなたは企業情報の調査担当です。Webページから、ページを運営するOrganizationの基本情報だけを抽出してください。

ルール:
- サービス名と運営企業名を混同しない。
- フッター、会社概要、住所、JSON-LD相当の記述を優先する。
- ページに根拠がない業種・所在地は推測で埋めず、空文字にする。
- organizationKind は company / individual / nonprofit / other のいずれか。
- 広告コピーではなく、管理台帳に保存できる簡潔な事実として返す。`;

export async function inferOrganizationFacts(
  raw: RawServiceInfo,
): Promise<InferredOrganizationFacts | null> {
  try {
    const client = new OpenAI({ timeout: TIMEOUT_MS, maxRetries: 1 });
    const response = await client.chat.completions.parse({
      model: MODEL,
      max_completion_tokens: 1600,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `URL: ${raw.url}`,
            raw.title ? `タイトル: ${raw.title}` : "",
            raw.description ? `メタ説明: ${raw.description}` : "",
            raw.organizationHints.length
              ? `機械抽出したOrganization名候補: ${raw.organizationHints.join("、")}`
              : "",
            raw.headings.length ? `見出し:\n${raw.headings.join("\n")}` : "",
            raw.footerText ? `フッター・法的表記:\n${raw.footerText}` : "",
            raw.bodyText ? `本文:\n${raw.bodyText}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      response_format: zodResponseFormat(
        OrganizationFactsSchema,
        "organization_facts",
      ),
    });
    return response.choices[0]?.message.parsed ?? null;
  } catch {
    return null;
  }
}
