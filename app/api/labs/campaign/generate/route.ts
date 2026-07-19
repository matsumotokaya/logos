// POST: one Campaign Lab generation — sources in, Brand Kit + LP out.
//
// NotebookLM-style intake: any mix of { url, pasted text, uploaded PDFs /
// images } funnels into the same creative stage (Claude structured outputs),
// which emits a Service Brand Kit. The LP is rendered server-side from the
// kit and returned inline; the same kit later feeds the video renderer.

import { NextResponse } from "next/server";
import { guardLabsRequest } from "@/lib/labs-access";
import { scrapeUrl, fetchImageAsBase64, type RawServiceInfo } from "@/lib/campaign/ingest";
import { generateBrandKit, type SourceFile } from "@/lib/campaign/creative";
import { renderLandingPage } from "@/lib/campaign/render-lp";

// Structured generation with documents can take a couple of minutes.
export const maxDuration = 300;

const MAX_FILES = 5;
const MAX_FILE_BASE64_LENGTH = 6_000_000; // ~4.5MB binary per file
const MAX_TEXT_LENGTH = 20_000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type GenerateBody = {
  url?: string;
  name?: string;
  description?: string;
  pastedText?: string;
  files?: { kind?: string; mediaType?: string; data?: string }[];
};

function parseFiles(raw: GenerateBody["files"]): SourceFile[] {
  if (!raw) return [];
  if (raw.length > MAX_FILES) throw new Error(`ファイルは${MAX_FILES}個までです`);
  return raw.map((f) => {
    if (typeof f.data !== "string" || f.data.length === 0)
      throw new Error("ファイルデータが空です");
    if (f.data.length > MAX_FILE_BASE64_LENGTH)
      throw new Error("ファイルが大きすぎます（1ファイル4.5MB上限）");
    if (f.kind === "pdf") return { kind: "pdf", data: f.data };
    if (f.kind === "image" && f.mediaType && IMAGE_TYPES.has(f.mediaType)) {
      return {
        kind: "image",
        mediaType: f.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: f.data,
      };
    }
    throw new Error("対応していないファイル形式です（PDF / PNG / JPEG / WebP / GIF）");
  });
}

function parseUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let candidate = raw.trim();
  if (!/^https?:\/\//.test(candidate)) candidate = `https://${candidate}`;
  const u = new URL(candidate); // throws on invalid
  if (u.protocol !== "https:" && u.protocol !== "http:")
    throw new Error("http/https のURLを指定してください");
  return u.href;
}

export async function POST(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart." },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  let url: string | null;
  let files: SourceFile[];
  try {
    body = (await req.json()) as GenerateBody;
    url = parseUrl(body.url);
    files = parseFiles(body.files);
    if (typeof body.pastedText === "string" && body.pastedText.length > MAX_TEXT_LENGTH)
      throw new Error("貼り付けテキストが長すぎます（2万字上限）");
    if (!url && files.length === 0 && !body.pastedText?.trim() && !body.name?.trim())
      throw new Error("URL・ファイル・テキストのいずれかのソースを追加してください");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "リクエストが不正です" },
      { status: 400 }
    );
  }

  try {
    // Stage 1: ingest
    let raw: RawServiceInfo | null = null;
    if (url) {
      raw = await scrapeUrl(url);
      // Use og:image as a key visual when the user attached nothing visual.
      if (!files.some((f) => f.kind === "image") && raw.ogImage) {
        const og = await fetchImageAsBase64(raw.ogImage);
        if (og) files.push({ kind: "image", mediaType: og.mediaType, data: og.data });
      }
    }

    // Stage 2: creative (Claude structured outputs → Brand Kit)
    const kit = await generateBrandKit({
      raw,
      userName: body.name?.trim() || undefined,
      userDescription: body.description?.trim() || undefined,
      pastedText: body.pastedText?.trim() || undefined,
      files,
    });

    // Stage 3: LP render
    const html = renderLandingPage(kit);

    return NextResponse.json({ kit, html });
  } catch (e) {
    console.error("Campaign generate failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生成に失敗しました" },
      { status: 500 }
    );
  }
}
