"use client";

// Fullscreen preview: big canvas + playback controls + the research note
// (star rating / free text) that drives adopt/drop decisions.
// A plain fixed overlay is used instead of <dialog> on purpose (React
// onChange does not fire reliably inside showModal in this codebase).

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  supportsLogo,
  type LabLogo,
} from "@/labs/motion/core/experiment-api";
import type { ExperimentEntry } from "@/labs/motion/experiments/registry";
import { getNote, setNote } from "@/labs/motion/core/notes-store";

export default function ExperimentModal({
  entry,
  logo,
  onClose,
}: {
  entry: ExperimentEntry;
  logo: LabLogo;
  onClose: () => void;
}) {
  const { meta, Component } = entry;
  const [playing, setPlaying] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [research, setResearch] = useState(() => getNote(meta.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = (next: { rating: number; note: string }) => {
    setResearch(next);
    setNote(meta.id, next);
  };

  const runnable = !!Component && supportsLogo(meta, logo);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-plate/60"
        onClick={onClose}
      />
      <div className="absolute inset-3 flex flex-col overflow-hidden rounded-2xl border border-hairline bg-paper md:inset-6">
        <header className="flex items-center gap-3 border-b border-hairline px-5 py-3">
          <span className="font-mono text-xs text-ink-faint">{meta.id}</span>
          <h2 className="text-sm font-semibold tracking-tight">{meta.title}</h2>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted">
            {CATEGORY_LABELS[meta.category]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-muted hover:text-ink"
          >
            閉じる (Esc)
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              {runnable && Component ? (
                <Component logo={logo} playing={playing} replayNonce={nonce} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                  このロゴ形式({logo.kind.toUpperCase()})には対応していません
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-hairline px-5 py-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs hover:border-ink-faint"
              >
                {playing ? "一時停止" : "再生"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNonce((n) => n + 1);
                  setPlaying(true);
                }}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs hover:border-ink-faint"
              >
                リプレイ
              </button>
              <span className="ml-auto text-[11px] text-ink-faint">
                想定尺: {meta.duration}
              </span>
            </div>
          </div>

          <aside className="w-full shrink-0 space-y-4 overflow-y-auto border-t border-hairline p-5 lg:w-80 lg:border-t-0 lg:border-l">
            <dl className="space-y-2 text-xs">
              <MetaRow label="技術" value={meta.tech.join(" / ")} mono />
              {meta.impressions.length > 0 && (
                <MetaRow label="印象" value={meta.impressions.map((t) => `#${t}`).join(" ")} />
              )}
              {meta.easing && <MetaRow label="イージング" value={meta.easing} mono />}
              {meta.notes && <MetaRow label="実装メモ" value={meta.notes} />}
            </dl>

            <div className="border-t border-hairline pt-4">
              <p className="mb-1.5 text-[11px] font-medium tracking-widest text-ink-muted uppercase">
                研究ノート
              </p>
              <div className="mb-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n}つ星`}
                    onClick={() =>
                      save({
                        ...research,
                        rating: research.rating === n ? 0 : n,
                      })
                    }
                    className={cn(
                      "text-lg leading-none transition",
                      n <= research.rating ? "text-accent" : "text-ink-faint hover:text-ink-muted",
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={research.note}
                onChange={(e) => save({ ...research, note: e.target.value })}
                placeholder="採用判断のメモ(どのロゴ形状で映えるか、組み合わせ候補など)"
                rows={6}
                className="w-full resize-y rounded-lg border border-hairline bg-white p-2.5 text-xs leading-relaxed outline-none focus:border-accent"
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] tracking-widest text-ink-faint uppercase">{label}</dt>
      <dd className={cn("mt-0.5 leading-relaxed text-ink", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </div>
  );
}
