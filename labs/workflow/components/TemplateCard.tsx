"use client";

// Catalog card: renders the selected logo composited into this template.
// Switching the logo in the rail recomposes every card — the lab's core loop.
// Invalid templates stay visible with their validation errors (the format's
// feedback loop for designers).

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import {
  getNotesSnapshot,
  getServerNotesSnapshot,
  subscribeNotes,
} from "@/labs/motion/core/notes-store";
import { CATEGORY_LABELS } from "@/labs/workflow/core/template-format";
import type { CatalogEntryDto, ComposeMetrics } from "@/labs/workflow/core/pipeline";
import { getWorkflowPresentationScene } from "@/labs/workflow/core/presentation-placement";
import { composeToUrl } from "@/labs/workflow/core/client";
import { BLEND_EXPLAIN } from "@/labs/workflow/core/tech-notes";

export const noteKey = (templateId: string) => `img:${templateId}`;

const PREVIEW_WIDTH = 720;

export default function TemplateCard({
  entry,
  logo,
  onComposed,
}: {
  entry: CatalogEntryDto;
  logo: LabLogo | null;
  onComposed: () => void;
}) {
  const { id, template, errors } = entry;
  const [url, setUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ComposeMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<string | null>(null);

  const note = useSyncExternalStore(
    subscribeNotes,
    () => getNotesSnapshot()[noteKey(id)],
    () => getServerNotesSnapshot()[noteKey(id)],
  );

  const broken = !template || errors.length > 0;

  useEffect(() => {
    if (broken || !logo) return;
    const controller = new AbortController();
    // Short trailing debounce: rapid logo switches collapse into one request
    // (and keeps setState out of the synchronous effect body).
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      composeToUrl(id, logo, { width: PREVIEW_WIDTH }, controller.signal)
        .then((r) => {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = r.url;
          setUrl(r.url);
          setMetrics(r.metrics);
          setBusy(false);
          onComposed();
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : "合成に失敗");
          setBusy(false);
        });
    }, 80);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, logo, broken]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const aspect = template
    ? template.canvas.width / template.canvas.height
    : 16 / 10;

  const content = (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[28px] border border-hairline bg-white p-3 md:p-4",
        !broken && "transition group-hover:border-ink-faint group-hover:shadow-sm",
      )}
    >
      <div
        className="relative overflow-hidden rounded-[20px] border border-hairline bg-paper"
        style={{ aspectRatio: aspect }}
      >
        {broken ? (
          <div className="flex h-full flex-col items-start justify-center gap-1 overflow-auto p-4">
            <span className="rounded-full border border-dashed border-red-300 px-2.5 py-0.5 text-[10px] text-red-500">
              テンプレート不正
            </span>
            {errors.map((e) => (
              <p key={e} className="font-mono text-[10px] leading-relaxed text-red-600">
                {e}
              </p>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={template.nameJa}
                className={cn(
                  "h-full w-full object-cover transition-opacity",
                  busy && "opacity-50",
                )}
              />
            )}
            {busy && (
              <span className="absolute right-2 bottom-2 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] text-white">
                合成中…
              </span>
            )}
            {!busy && metrics && (
              <span className="absolute right-2 bottom-2 rounded-full bg-ink/50 px-2 py-0.5 font-mono text-[10px] text-white">
                {metrics.totalMs}ms
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-1 pb-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] text-ink-faint">{id}</p>
            <h3 className="mt-1 text-base font-semibold text-balance">
              {template?.nameJa ?? id}
            </h3>
            {template?.notesJa && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-pretty text-ink-muted">
                {template.notesJa}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {note?.rating ? (
              <span className="block text-[11px] text-accent">
                {"★".repeat(note.rating)}
              </span>
            ) : null}
            {template && (
              <span className="mt-2 block text-xs text-accent">
                詳細を見る →
              </span>
            )}
          </div>
        </div>
        {template && (
          <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
            <span className="rounded-full bg-ink/5 px-2 py-0.5">
              {CATEGORY_LABELS[template.category]}
            </span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
              {getWorkflowPresentationScene(template)}
            </span>
            <span
              className="rounded-full border border-hairline px-2 py-0.5 font-mono"
              title={BLEND_EXPLAIN[template.surface.logo.blend]}
            >
              {template.surface.logo.blend}
            </span>
            {template.surface.displacement && (
              <span
                className="rounded-full border border-hairline px-2 py-0.5 font-mono"
                title={`ディスプレイスメント: RGBマップで面のシワ・凹凸を再現(強度${template.surface.displacement.strength}px)。詳細ページの「技術解説」を参照`}
              >
                displace
              </span>
            )}
            {template.surface.logo.shadow && (
              <span
                className="rounded-full border border-hairline px-2 py-0.5 font-mono"
                title="コンタクトシャドウ: ロゴのアルファをぼかして落とす別レイヤー"
              >
                shadow
              </span>
            )}
            {(template.impressions ?? []).map((t) => (
              <span key={t} className="rounded-full px-1 py-0.5">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );

  if (broken) {
    return content;
  }

  return (
    <Link
      href={`/labs/workflow/${id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}
