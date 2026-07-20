// POST: kick off one Campaign Lab generation as a detached server-side job.
//
// NotebookLM-style intake: any mix of { url, pasted text, uploaded PDFs /
// images } funnels into the same creative stage (Claude structured outputs),
// which emits a Service Brand Kit. The pipeline runs detached from this
// request and persists every progress event to the job store, so the client
// can close the tab / lose the connection and re-attach later by polling
// GET /api/labs/campaign/jobs — nothing is lost on reload.
//
// Note: the detached run assumes a long-lived Node process (local dev / a
// real server). On serverless the process may be frozen after the response —
// Labs is local-first, and Phase 1 moves this to a real queue.

import { NextResponse } from "next/server";
import { guardLabsRequest } from "@/lib/labs-access";
import { requireUser } from "@/lib/supabase/server";
import type { SourceFile } from "@/lib/campaign/creative";
import { runCampaignPipeline } from "@/lib/campaign/pipeline";
import {
  createCampaignJob,
  appendCampaignStep,
  updateCampaignPartial,
  saveCampaignJobDraft,
  completeCampaignJob,
  failCampaignJob,
} from "@/lib/campaign/jobs";

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
  const user = await requireUser(req);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local and restart." },
      { status: 500 }
    );
  }

  let url: string | null;
  let files: SourceFile[];
  let body: GenerateBody;
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

  const job = createCampaignJob(user.id, {
    url,
    name: body.name?.trim() || null,
    files: files.length,
    hasText: Boolean(body.pastedText?.trim()),
  });

  // Detached run: progress and result live in the job store, not in this
  // response. The client re-attaches via polling — reload-safe by design.
  void runCampaignPipeline(
    {
      url,
      userName: body.name?.trim() || undefined,
      userDescription: body.description?.trim() || undefined,
      pastedText: body.pastedText?.trim() || undefined,
      files,
    },
    {
      onProgress: (event) => appendCampaignStep(job.id, event),
      onPartial: (patch) => updateCampaignPartial(job.id, patch),
      onDraft: (kit, html) => saveCampaignJobDraft(job.id, { kit, html }),
    }
  )
    .then((result) =>
      completeCampaignJob(job.id, {
        kit: result.kit,
        html: result.html,
        meta: {
          captured: result.meta.captured,
          adjudicated: result.meta.adjudicated,
          verification: result.meta.verification,
          usage: result.meta.usage,
        },
      })
    )
    .catch((e) => {
      console.error("Campaign generate failed:", e);
      failCampaignJob(job.id, e instanceof Error ? e.message : "生成に失敗しました");
    });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
