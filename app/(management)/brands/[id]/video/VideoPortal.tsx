"use client";

// The brand's video portal: every video this brand has, plus the "add a video"
// action that picks a template.
//
// The first entry is the brand's default product CM. It is shown even when
// nothing has been generated and even though no row exists for it yet, because
// every brand is offered one — and it stays unpublished until someone chooses
// to publish, so an unused default costs the brand nothing.
//
// The add flow asks for the template first and never lets it change afterwards:
// the template decides the scene structure and which material slots exist, so
// switching it later would invalidate everything filled in. Same contract as
// slide-factory's per-property `deliverable`.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { videoFetch } from "@/lib/video/client";
import { refreshBrandTree } from "@/lib/brand-events";
import {
  DEFAULT_ADDABLE_VIDEO_TEMPLATE,
  VIDEO_TEMPLATE_FAMILIES,
  VIDEO_TEMPLATES,
  type VideoTemplateId,
} from "@/lib/video/templates";
import { VIDEO_STATE_LABEL, type VideoSummary } from "@/lib/video/asset";


export default function VideoPortal({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<VideoTemplateId>(DEFAULT_ADDABLE_VIDEO_TEMPLATE);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await videoFetch(`/api/brands/${brandId}/videos`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "動画を取得できませんでした");
      }
      const json = (await res.json()) as {
        brand: { name: string };
        videos: VideoSummary[];
      };
      setVideos(json.videos);
      setBrandName(json.brand.name);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画を取得できませんでした");
      setVideos([]);
    }
  }, [brandId]);

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

  async function submit() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        template,
        title: title.trim() || undefined,
      };
      const res = await videoFetch(`/api/brands/${brandId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;
      if (!res.ok || !json?.id) {
        throw new Error(json?.error ?? "動画を追加できませんでした");
      }
      setAdding(false);
      setTitle("");
      // The left tree lists videos too, so it has to pick the new one up.
      refreshBrandTree();
      router.push(`/brands/${brandId}/video/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "動画を追加できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-muted">VIDEO</p>
          <h1 className="mt-2 text-balance font-display text-3xl font-semibold">
            {brandName ? `${brandName}の動画` : "動画"}
          </h1>
          <p className="mt-3 text-pretty text-sm text-ink-muted">
            このブランドが持つ動画の一覧です。テンプレートを選んで追加でき、
            作ったあとも素材を足して作り直せます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-paper transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          ＋ 動画を追加
        </button>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}

      {videos === null ? (
        <p className="text-sm text-ink-muted">読み込み中…</p>
      ) : (
        <div className="space-y-8">
          {VIDEO_TEMPLATE_FAMILIES.map((family) => {
            const ids = new Set(family.variants.map((variant) => variant.id));
            const rows = videos.filter((video) => ids.has(video.template));
            // A category with nothing in it is not shown: the page lists what
            // this brand has, and the way to start a new kind is the add button.
            if (rows.length === 0) return null;
            return (
              <section key={family.name}>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  {family.name}
                </h2>
                <ul className="mt-3 space-y-3">
                  {rows.map((video) => (
                    <li key={`${video.template}-${video.id}`}>
                      <VideoRow brandId={brandId} video={video} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {adding ? (
        <AddVideoOverlay
          template={template}
          onTemplate={setTemplate}
          title={title}
          onTitle={setTitle}
          submitting={submitting}
          onCancel={() => setAdding(false)}
          onSubmit={submit}
        />
      ) : null}
    </main>
  );
}

function VideoRow({ brandId, video }: { brandId: string; video: VideoSummary }) {
  const template = VIDEO_TEMPLATES[video.template];
  return (
    <Link
      href={`/brands/${brandId}/video/${video.id}`}
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline px-5 py-4 transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{video.title}</span>
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
            {template?.variant ?? video.template}
          </span>
          {video.isPlaceholder ? (
            <span className="rounded-full border border-dashed border-ink-faint px-2 py-0.5 text-[10px] text-ink-muted">
              既定
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block text-[11px] text-ink-muted">
          {VIDEO_STATE_LABEL[video.state]}
          {video.published ? " ・ 公開中" : " ・ 未公開"}
        </span>
      </span>
      <span className="text-xs text-accent">開く →</span>
    </Link>
  );
}

function AddVideoOverlay({
  template,
  onTemplate,
  title,
  onTitle,
  submitting,
  onCancel,
  onSubmit,
}: {
  template: VideoTemplateId;
  onTemplate: (id: VideoTemplateId) => void;
  title: string;
  onTitle: (value: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  // A React-controlled overlay rather than <dialog showModal()>: React's
  // synthetic onChange does not fire for inputs inside a modal dialog, so a
  // controlled form there silently stops updating (see components/Account.tsx).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const selected = VIDEO_TEMPLATES[template];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-video-title"
        className="relative w-full max-w-lg rounded-2xl border border-hairline bg-paper p-6 shadow-xl"
      >
        <h2 id="add-video-title" className="font-display text-lg font-semibold">
          動画を追加
        </h2>
        <p className="mt-2 text-[12px] text-ink-muted">
          テンプレートを選択してください。動画のテンプレートは変更ができないため、別のテンプレートを利用する場合は動画を新規作成してください。
        </p>

        <fieldset className="mt-5">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            テンプレート
          </legend>
          <div className="mt-2.5 space-y-2">
            {VIDEO_TEMPLATE_FAMILIES.map((family) => {
              const active = family.variants.some((item) => item.id === template);
              return (
                <div
                  key={family.name}
                  className={cn(
                    "rounded-xl border p-3.5 transition",
                    active ? "border-ink bg-ink/[0.04]" : "border-hairline hover:border-ink-muted",
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="video-template-family"
                      value={family.name}
                      checked={active}
                      // Picking a family lands on its first style, so the pair
                      // is always a resolvable template id.
                      onChange={() => onTemplate(family.variants[0].id)}
                    />
                    <span className="text-[13px] font-semibold">{family.name}</span>
                  </label>

                  {active ? (
                    <label className="mt-2.5 block pl-7">
                      <span className="text-[11px] text-ink-muted">スタイル</span>
                      <select
                        value={template}
                        onChange={(e) => onTemplate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-hairline bg-white px-2.5 py-2 text-[12px]"
                      >
                        {family.variants.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.variant}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* The title belongs to the template that needs one. An event has a
            name before it has anything else, and asking for it at the bottom
            of the dialog — under a heading reading 任意 — buried the one
            field this template actually wants. */}
        {template === "event-cm" || template === "event-promo" ? (
          <label className="mt-5 block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              イベント名
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="名称未設定"
              autoFocus
              className="mt-2 w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[13px]"
            />
            <span className="mt-1.5 block text-[11px] text-ink-muted">
              あとから変更できます。
            </span>
          </label>
        ) : (
          <p className="mt-5 rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            {selected.requires}が必要です。トップ（CM Maker）でソースから生成したBrand Kitを使います。
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-hairline px-5 py-2.5 text-xs font-semibold transition hover:border-ink"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
          >
            {submitting ? "追加中…" : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}