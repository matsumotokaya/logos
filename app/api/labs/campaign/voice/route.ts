// POST: generate the CM voice track (TTS + timing) for a finished campaign
// job, as a detached run — same reload-safe pattern as /generate. Progress
// lines land in the job's step log; the result (scene/caption timings) is
// stored on the job, the WAV next to it. The video itself is not rendered
// here: the Player composes it in the browser from kit + track + audio.
//
// Explicit user action by design (TTS costs money), mirroring scene 10's
// manual mockup generation.

import { NextResponse } from "next/server";
import { guardLabsRequest } from "@/lib/labs-access";
import { requireUser } from "@/lib/supabase/server";
import { generateCmVoice, cmVoiceAvailable } from "@/lib/campaign/voice";
import { renderCmMp4 } from "@/lib/campaign/render-video";
import {
  getCampaignJob,
  appendCampaignStep,
  startCampaignCm,
  saveCampaignCmVoice,
  finishCampaignCm,
  failCampaignCm,
} from "@/lib/campaign/jobs";

export const maxDuration = 300;

export async function POST(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);

  if (!cmVoiceAvailable()) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not set. Add it to .env.local (or set CAMPAIGN_TTS_MOCK=1) and restart.",
      },
      { status: 500 }
    );
  }

  let jobId: string;
  try {
    const body = (await req.json()) as { jobId?: string };
    if (typeof body.jobId !== "string" || body.jobId.length === 0)
      throw new Error("jobId を指定してください");
    jobId = body.jobId;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "リクエストが不正です" },
      { status: 400 }
    );
  }

  const job = getCampaignJob(jobId);
  if (!job || job.userId !== user.id)
    return NextResponse.json({ error: "ジョブが見つかりません" }, { status: 404 });
  if (job.status !== "done" || !job.kit)
    return NextResponse.json(
      { error: "キャンペーンの生成が完了してから実行してください" },
      { status: 409 }
    );
  if (!job.kit.cm_script?.length)
    return NextResponse.json(
      {
        error:
          "このキャンペーンには構造化CMスクリプトがありません（旧形式）。キャンペーンを再生成してください。",
      },
      { status: 409 }
    );
  if (job.cm?.status === "running")
    return NextResponse.json({ jobId }, { status: 202 }); // already in flight

  const kit = job.kit;
  startCampaignCm(jobId);
  appendCampaignStep(jobId, { message: "video: 製品紹介動画の生成を開始", level: "info" });

  // Detached chain: voice (TTS) → browser preview becomes available → MP4
  // render (local-first; skipped with a warn where Chromium can't run) → the
  // LP's video slot picks the MP4 up on next serve.
  void generateCmVoice(kit, (message, level) =>
    appendCampaignStep(jobId, { message, level: level ?? "info" })
  )
    .then(async (result) => {
      saveCampaignCmVoice(jobId, result);
      appendCampaignStep(jobId, {
        message: "video: プレビュー再生が可能になりました — MP4を書き出し中…（数分かかります）",
        level: "success",
      });
      try {
        await renderCmMp4(jobId);
        finishCampaignCm(jobId, { mp4: true });
        appendCampaignStep(jobId, {
          message: "video: MP4書き出し完了 — セールスページ（LP）の動画スロットにも掲載されます",
          level: "success",
        });
      } catch (e) {
        console.error("Campaign MP4 render failed:", e);
        finishCampaignCm(jobId, { mp4: false });
        appendCampaignStep(jobId, {
          message:
            "video: MP4書き出しはこの環境では実行できませんでした（ブラウザ内プレビューは利用できます）",
          level: "warn",
        });
      }
    })
    .catch((e) => {
      console.error("Campaign voice failed:", e);
      const message = e instanceof Error ? e.message : "音声生成に失敗しました";
      appendCampaignStep(jobId, { message: `video: ${message}`, level: "warn" });
      failCampaignCm(jobId, message);
    });

  return NextResponse.json({ jobId }, { status: 202 });
}
