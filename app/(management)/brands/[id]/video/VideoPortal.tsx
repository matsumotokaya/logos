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
  ADDABLE_VIDEO_TEMPLATES,
  VIDEO_TEMPLATES,
  type VideoTemplateId,
} from "@/lib/video/templates";
import { VIDEO_STATE_LABEL, type VideoSummary } from "@/lib/video/asset";
import { BUNDLED_BRIEFS } from "@/remotion/event/briefs";

const EMPTY_BRIEF_VALUE = "__empty__";
const TEMPLATE_TAKE_PREFIX = "take:";

export default function VideoPortal({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [template, setTemplate] = useState<VideoTemplateId>("event-promo");
  const [seed, setSeed] = useState<string>(
    () => `${TEMPLATE_TAKE_PREFIX}${videos?.[0]?.id ?? ""}` || EMPTY_BRIEF_VALUE,
  );
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
      // Default the seed to the first existing event-promo Take of this brand.
      // That is the only path that carries real materials into the new Take.
      setSeed((current) => {
        if (current !== EMPTY_BRIEF_VALUE && current.startsWith(TEMPLATE_TAKE_PREFIX)) {
          return current;
        }
        const firstEvent = json.videos.find((v) => v.template === "event-promo");
        return firstEvent
          ? `${TEMPLATE_TAKE_PREFIX}${firstEvent.id}`
          : EMPTY_BRIEF_VALUE;
      });
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
      if (template === "event-promo" && seed !== EMPTY_BRIEF_VALUE) {
        if (seed.startsWith(TEMPLATE_TAKE_PREFIX)) {
          body.templateTakeId = seed.slice(TEMPLATE_TAKE_PREFIX.length);
        } else {
          body.briefSlug = seed;
        }
      }
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

  const existingEventTakes = (videos ?? []).filter(
    (video) => video.template === "event-promo",
  );

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
        <ul className="space-y-3">
          {videos.map((video) => (
            <li key={`${video.template}-${video.id}`}>
              <VideoRow brandId={brandId} video={video} />
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <AddVideoOverlay
          template={template}
          onTemplate={setTemplate}
          seed={seed}
          onSeed={setSeed}
          existingTakes={existingEventTakes}
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
            {template?.name ?? video.template}
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
  seed,
  onSeed,
  existingTakes,
  title,
  onTitle,
  submitting,
  onCancel,
  onSubmit,
}: {
  template: VideoTemplateId;
  onTemplate: (id: VideoTemplateId) => void;
  seed: string;
  onSeed: (value: string) => void;
  existingTakes: VideoSummary[];
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
          テンプレートは作成時に決まり、あとから変更できません。シーン構成と素材スロットが変わるためです。
        </p>

        <fieldset className="mt-5">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            テンプレート
          </legend>
          <div className="mt-2.5 space-y-2">
            {ADDABLE_VIDEO_TEMPLATES.map((item) => (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition",
                  template === item.id
                    ? "border-ink bg-ink/[0.04]"
                    : "border-hairline hover:border-ink-muted",
                )}
              >
                <input
                  type="radio"
                  name="video-template"
                  value={item.id}
                  checked={template === item.id}
                  onChange={() => onTemplate(item.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">
                    {item.name}
                    <span className="ml-2 font-normal text-ink-muted">{item.duration}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">
                    {item.summary}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {template === "event-promo" ? (
          <label className="mt-5 block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              下敷きにする動画
            </span>
            <select
              value={seed}
              onChange={(e) => onSeed(e.target.value)}
              className="mt-2 w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[13px]"
            >
              {existingTakes.length > 0 ? (
                <optgroup label="このブランドの既存の動画からコピー">
                  {existingTakes.map((video) => (
                    <option
                      key={video.id}
                      value={`${TEMPLATE_TAKE_PREFIX}${video.id}`}
                    >
                      {video.title}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {BUNDLED_BRIEFS.length > 0 ? (
                <optgroup label="サンプルブリーフ">
                  {BUNDLED_BRIEFS.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value={EMPTY_BRIEF_VALUE}>空から作る</option>
            </select>
            <span className="mt-1.5 block text-[11px] text-ink-muted">
              既存の動画を選ぶとそのブリefと素材を複製します。サンプルは素材が入っていないのでレンダーは空になります。
            </span>
          </label>
        ) : (
          <p className="mt-5 rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            {selected.requires}が必要です。トップ（CM Maker）でソースから生成したBrand Kitを使います。
          </p>
        )}

        <label className="mt-5 block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            タイトル（任意）
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="未入力ならテンプレートの既定名を使います"
            className="mt-2 w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-[13px]"
          />
        </label>

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
            {submitting ? "追加中…" : "この構成で追加"}
          </button>
        </div>
      </div>
    </div>
  );
}