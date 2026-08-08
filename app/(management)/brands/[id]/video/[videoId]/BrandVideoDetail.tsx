"use client";

// One V2 video Take under a brand. This component renders the matching surface:
//
//   event-promo → EventVideoWorkspace (goal + material slots)
//   product-cm with no pinned voice → the campaign narration screen
//   product-cm with pinned voice → the V2 render/publication workspace
//
// The narration screen remains the authoring entry point. Once it produces a
// voice track, the Take becomes self-contained and the V2 workspace takes over.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { videoFetch } from "@/lib/video/client";
import CampaignDetail from "@/app/campaigns/[id]/CampaignDetail";
import EventVideoWorkspace from "@/components/video/EventVideoWorkspace";
import { VIDEO_STATE_LABEL, type VideoState } from "@/lib/video/asset";
import type { VideoTemplateId } from "@/lib/video/templates";
import type { EventBrief } from "@/remotion/event/types";

type VideoAsset = {
  id: string;
  brandId: string;
  title: string;
  template: VideoTemplateId;
  templateName: string;
  published: boolean;
  publicUrl: string | null;
  briefSlug: string | null;
  brief: EventBrief | Record<string, unknown> | null;
  campaignJobId: string | null;
  state: VideoState;
  createdAt: string;
  render: { status: "running" | "done" | "error"; error: string | null; renderedAt: string | null } | null;
  /** Signed same-origin URL of the MP4 in R2, when one has been rendered. */
  mp4Url: string | null;
};

/** A render takes minutes; poll while one is in flight. */
const RENDER_POLL_MS = 5000;

type Resolved = { kind: "asset"; video: VideoAsset };

function hasPinnedProductVoice(brief: VideoAsset["brief"]): boolean {
  if (!brief || typeof brief !== "object") return false;
  const voice = (brief as Record<string, unknown>).voice;
  if (!voice || typeof voice !== "object") return false;
  return (
    typeof (voice as Record<string, unknown>).track === "object" &&
    typeof (voice as Record<string, unknown>).audio === "string"
  );
}

export default function BrandVideoDetail({
  brandId,
  videoId,
}: {
  brandId: string;
  videoId: string;
}) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "動画を取得できませんでした");
      }
      setResolved((await res.json()) as Resolved);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画を取得できませんでした");
    }
  }, [brandId, videoId]);

  useEffect(() => {
    // Kept off the synchronous effect path (same as CampaignDetail): setState
    // during the effect body triggers cascading renders.
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Keep polling while the MP4 render runs, so the player appears on its own.
  const rendering = resolved?.kind === "asset" && resolved.video.render?.status === "running";
  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(() => void load(), RENDER_POLL_MS);
    return () => clearInterval(timer);
  }, [rendering, load]);

  async function startRender() {
    setSaving(true);
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}/render`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 202) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "MP4の作成を開始できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "MP4の作成を開始できませんでした");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(next: boolean) {
    if (resolved?.kind !== "asset") return;
    setSaving(true);
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "更新できませんでした");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新できませんでした");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {error}
        </p>
        <Link href={`/brands/${brandId}/video`} className="mt-5 inline-block text-xs text-accent">
          ← 動画一覧へ
        </Link>
      </main>
    );
  }

  if (!resolved) {
    return <main className="px-6 py-10 text-sm text-ink-muted md:px-10">読み込み中…</main>;
  }

  const video = resolved.video;

  // A Product CM Take is created before narration is generated. Keep that
  // draft in the established authoring screen until the voice RPC pins the
  // WAV and timing into the Take; a refresh then lands in the V2 workspace.
  if (
    video.template === "product-cm" &&
    video.campaignJobId &&
    !hasPinnedProductVoice(video.brief)
  ) {
    return (
      <CampaignDetail
        id={video.campaignJobId}
        sampleHtml={null}
        embedded
        view="video"
        brandId={brandId}
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
      <nav aria-label="パンくず" className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
        <Link href={`/brands/${brandId}`} className="hover:text-ink">
          ブランド
        </Link>
        <span aria-hidden className="text-ink-faint">/</span>
        <Link href={`/brands/${brandId}/video`} className="hover:text-ink">
          動画
        </Link>
        <span aria-hidden className="text-ink-faint">/</span>
        <span className="font-semibold text-ink">{video.title}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-hairline pb-6">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-semibold text-ink-muted">{video.templateName.toUpperCase()}</p>
          <h1 className="mt-2 text-balance font-display text-3xl font-semibold">{video.title}</h1>
          <p className="mt-3 text-[12px] text-ink-muted">
            {VIDEO_STATE_LABEL[video.state]}
            {video.published ? " ・ 公開中" : " ・ 未公開"}
            {video.briefSlug ? ` ・ ブリーフ: ${video.briefSlug}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {video.published && video.publicUrl ? (
            <a
              href={video.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              公開動画 ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void startRender()}
            disabled={saving || video.render?.status === "running" || !video.brief}
            className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
          >
            {video.render?.status === "running"
              ? "MP4を作成中…"
              : video.mp4Url
                ? "MP4を作り直す"
                : "MP4を作成"}
          </button>
          <button
            type="button"
            onClick={() => void togglePublished(!video.published)}
            disabled={saving}
            className="rounded-full border border-ink px-4 py-2 text-xs font-semibold transition hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {saving ? "更新中…" : video.published ? "公開をやめる" : "公開する"}
          </button>
        </div>
      </header>

      {video.render?.status === "running" ? (
        <p className="flex items-center gap-2 rounded-xl border border-hairline bg-ink/5 px-4 py-2.5 text-[12px] text-ink-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          MP4を作成中（数分）— このページを離れても処理は続き、完成するとここに表示されます
        </p>
      ) : null}
      {video.render?.status === "error" && video.render.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          MP4の作成に失敗しました: {video.render.error}
        </p>
      ) : null}
      {video.mp4Url ? (
        <section className="rounded-2xl border border-hairline p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">書き出したMP4</h2>
            <a href={video.mp4Url} download className="text-[11px] text-accent hover:underline">
              ダウンロード
            </a>
          </div>
          {/* Served from R2 through a signed same-origin route with Range
              support, so this is the same file any other machine would get. */}
          <video
            src={video.mp4Url}
            controls
            className="mt-3 w-full rounded-xl bg-[#0b0d13]"
            style={{ aspectRatio: "16 / 9" }}
          />
          {video.render?.renderedAt ? (
            <p className="mt-2 text-[11px] text-ink-faint">
              書き出し: {new Date(video.render.renderedAt).toLocaleString("ja-JP")}
            </p>
          ) : null}
        </section>
      ) : null}

      {video.template === "event-promo" && video.brief ? (
        <EventVideoWorkspace brief={video.brief as EventBrief} />
      ) : video.template === "product-cm" ? (
        <section className="rounded-2xl border border-hairline p-5">
          <h2 className="text-balance text-sm font-semibold">Product CM入力</h2>
          <p className="mt-2 text-pretty text-xs text-ink-muted">
            Brand Kit、ナレーションタイミング、固定済みWAVをTakeが保持します。
            MP4の再生成はローカルのキャンペーンジョブに依存しません。
          </p>
        </section>
      ) : (
        <p className="rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[12px] text-ink-muted">
          このイベント動画にはまだブリーフがありません。
        </p>
      )}
    </main>
  );
}
