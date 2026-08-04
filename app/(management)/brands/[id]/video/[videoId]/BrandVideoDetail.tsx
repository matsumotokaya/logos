"use client";

// One video under a brand. The path segment is either a video asset id or the
// campaign job id behind the brand's default product CM; the API resolves
// which (see app/api/brands/[id]/videos/[videoId]/route.ts) and this component
// renders the matching surface:
//
//   event-promo → EventVideoWorkspace (goal + material slots)
//   product-cm / campaign → the existing campaign video screen, unchanged
//
// Keeping the legacy screen rather than reimplementing it means the CM
// pipeline stays the single implementation for product videos.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/app/campaigns/campaign-ui";
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
  briefSlug: string | null;
  brief: EventBrief | null;
  campaignJobId: string | null;
  state: VideoState;
  createdAt: string;
};

type Resolved =
  | { kind: "asset"; video: VideoAsset }
  | { kind: "campaign"; jobId: string };

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
      const res = await authedFetch(`/api/brands/${brandId}/videos/${videoId}`);
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

  async function togglePublished(next: boolean) {
    if (resolved?.kind !== "asset") return;
    setSaving(true);
    try {
      const res = await authedFetch(`/api/brands/${brandId}/videos/${videoId}`, {
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

  // The brand's default product CM, or any product-cm video: the existing
  // campaign screen already handles narration, MP4 export and preview.
  if (resolved.kind === "campaign") {
    return (
      <CampaignDetail id={resolved.jobId} sampleHtml={null} embedded view="video" brandId={brandId} />
    );
  }

  const video = resolved.video;

  if (video.template === "product-cm") {
    return video.campaignJobId ? (
      <CampaignDetail
        id={video.campaignJobId}
        sampleHtml={null}
        embedded
        view="video"
        brandId={brandId}
      />
    ) : (
      <main className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        <h1 className="font-display text-2xl font-semibold">{video.title}</h1>
        <p className="mt-3 text-sm text-ink-muted">
          この製品紹介動画に紐づくBrand Kitがまだありません。トップ（CM Maker）でソースから生成すると、
          ここにナレーションとMP4の導線が出ます。
        </p>
        <Link href={`/brands/${brandId}/video`} className="mt-5 inline-block text-xs text-accent">
          ← 動画一覧へ
        </Link>
      </main>
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
        <button
          type="button"
          onClick={() => void togglePublished(!video.published)}
          disabled={saving}
          className="rounded-full border border-ink px-4 py-2 text-xs font-semibold transition hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {saving ? "更新中…" : video.published ? "公開をやめる" : "公開する"}
        </button>
      </header>

      {video.brief ? (
        <EventVideoWorkspace brief={video.brief} />
      ) : (
        <p className="rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[12px] text-ink-muted">
          このイベント動画にはまだブリーフがありません。
        </p>
      )}
    </main>
  );
}
