"use client";

// Fullscreen inspector: high-res render, placement/color controls, per-stage
// timing readout, download, and the adopt/drop research note (star + memo).
// Plain fixed overlay, not <dialog> — React onChange misfires inside
// showModal (see project memory).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import { getNote, setNote } from "@/labs/motion/core/notes-store";
import type { Template2D, LogoColorMode } from "@/labs/image/core/template-format";
import type { ComposeMetrics, ComposeOptions } from "@/labs/image/core/pipeline";
import { composeToUrl } from "@/labs/image/core/client";
import { templateTechNotes } from "@/labs/image/core/tech-notes";
import { noteKey } from "./TemplateCard";

const WIDTHS = [1024, 1600, 2048, 2600];
const COLOR_MODES: [LogoColorMode | "template", string][] = [
  ["template", "テンプレート既定"],
  ["original", "オリジナル"],
  ["mono-dark", "黒単色"],
  ["mono-light", "白単色"],
];

export default function ComposeModal({
  template,
  logo,
  onClose,
  onComposed,
}: {
  template: Template2D;
  logo: LabLogo;
  onClose: () => void;
  onComposed: () => void;
}) {
  const [width, setWidth] = useState(1600);
  const [logoScale, setLogoScale] = useState(1);
  const [offsetU, setOffsetU] = useState(0);
  const [offsetV, setOffsetV] = useState(0);
  const [colorMode, setColorMode] = useState<LogoColorMode | "template">("template");

  const [url, setUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ComposeMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const [rating, setRating] = useState(() => getNote(noteKey(template.id)).rating);
  const [memo, setMemo] = useState(() => getNote(noteKey(template.id)).note);

  const techNotes = useMemo(() => templateTechNotes(template), [template]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced recompose whenever any knob changes.
  useEffect(() => {
    const controller = new AbortController();
    const options: ComposeOptions = {
      width,
      logoScale,
      offsetU,
      offsetV,
      ...(colorMode !== "template" ? { colorMode } : {}),
    };
    const timer = setTimeout(() => {
      setBusy(true);
      setError(null);
      composeToUrl(template.id, logo, options, controller.signal)
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
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, logo, width, logoScale, offsetU, offsetV, colorMode]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const saveNote = useCallback(
    (nextRating: number, nextMemo: string) => {
      setRating(nextRating);
      setMemo(nextMemo);
      setNote(noteKey(template.id), { rating: nextRating, note: nextMemo });
    },
    [template.id],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-hairline px-5 py-3">
          <span className="font-mono text-[11px] text-ink-faint">{template.id}</span>
          <h2 className="text-sm font-semibold tracking-tight">{template.nameJa}</h2>
          <span className="text-[11px] text-ink-muted">{template.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full border border-hairline px-3 py-1 text-xs text-ink-muted transition hover:text-ink"
          >
            閉じる (Esc)
          </button>
        </header>

        <div className="grid flex-1 gap-0 overflow-auto lg:grid-cols-[1fr_290px]">
          <div className="relative flex items-center justify-center bg-paper p-4">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={template.nameJa}
                className={cn(
                  "max-h-[70vh] w-full rounded-lg object-contain transition-opacity",
                  busy && "opacity-50",
                )}
              />
            ) : (
              <p className="py-24 text-sm text-ink-muted">合成中…</p>
            )}
            {busy && url && (
              <span className="absolute right-6 bottom-6 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] text-white">
                合成中…
              </span>
            )}
          </div>

          <aside className="space-y-5 border-t border-hairline p-5 lg:border-t-0 lg:border-l">
            <Control label={`ロゴサイズ ×${logoScale.toFixed(2)}`}>
              <input
                type="range"
                min={0.5}
                max={1.6}
                step={0.05}
                value={logoScale}
                onChange={(e) => setLogoScale(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </Control>
            <Control label={`位置 U ${offsetU.toFixed(2)} / V ${offsetV.toFixed(2)}`}>
              <input
                type="range"
                min={-0.3}
                max={0.3}
                step={0.01}
                value={offsetU}
                onChange={(e) => setOffsetU(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <input
                type="range"
                min={-0.3}
                max={0.3}
                step={0.01}
                value={offsetV}
                onChange={(e) => setOffsetV(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </Control>
            <Control label="ロゴの色">
              <div className="flex flex-wrap gap-1.5">
                {COLOR_MODES.map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setColorMode(v)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                      colorMode === v
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-ink-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Control>
            <Control label="出力解像度">
              <div className="flex flex-wrap gap-1.5">
                {WIDTHS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWidth(w)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition",
                      width === w
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-ink-muted hover:text-ink",
                    )}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            </Control>

            {metrics && (
              <Control label="計測(コスト原価の基礎データ)">
                <table className="w-full font-mono text-[10px] text-ink-muted">
                  <tbody>
                    <Row k="出力" v={`${metrics.outWidth}×${metrics.outHeight}px`} />
                    <Row
                      k="舞台ラスタライズ"
                      v={`${metrics.stageMs}ms`}
                      hint="舞台SVGをsharpでこの解像度にレンダリング"
                    />
                    <Row
                      k="ロゴラスタライズ"
                      v={`${metrics.logoMs}ms`}
                      hint={`宛先矩形の最大辺×2倍(スーパーサンプル)= ${metrics.logoRasterPx.width}×${metrics.logoRasterPx.height}px でロゴを展開`}
                    />
                    <Row
                      k="射影+ディスプレイス"
                      v={`${metrics.warpMs}ms`}
                      hint="ホモグラフィの逆写像+変位場サンプリングをピクセルごとに計算(純TypeScript)"
                    />
                    <Row
                      k="レイヤー合成"
                      v={`${metrics.compositeMs}ms`}
                      hint="シャドウ→ロゴ→ライティング層の順にsharp.compositeでブレンド"
                    />
                    <Row k="合計" v={`${metrics.totalMs}ms`} strong />
                    <Row k="外部APIコスト" v="$0.00(決定論的合成)" />
                  </tbody>
                </table>
              </Control>
            )}

            <Control label="技術解説(このテンプレートのパイプライン)">
              <div className="space-y-2">
                {techNotes.map((note) => (
                  <details
                    key={note.title}
                    className="group rounded-lg border border-hairline open:bg-paper"
                  >
                    <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[11px] font-medium text-ink marker:content-none">
                      <span className="mr-1 inline-block text-ink-faint transition group-open:rotate-90">
                        ›
                      </span>
                      {note.title}
                    </summary>
                    <p className="px-2.5 pb-2.5 text-[11px] leading-relaxed text-ink-muted">
                      {note.body}
                    </p>
                  </details>
                ))}
              </div>
            </Control>

            {url && (
              <a
                href={url}
                download={`${template.id}-${logo.name}.png`}
                className="block rounded-lg border border-accent px-3 py-2 text-center text-xs font-medium text-accent transition hover:bg-accent hover:text-white"
              >
                PNGをダウンロード
              </a>
            )}

            <Control label="研究ノート(採用判断)">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n}つ星`}
                    onClick={() => saveNote(rating === n ? 0 : n, memo)}
                    className={cn(
                      "text-lg transition",
                      n <= rating ? "text-accent" : "text-ink-faint hover:text-ink-muted",
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={memo}
                onChange={(e) => saveNote(rating, e.target.value)}
                placeholder="所感・改善点・採用可否のメモ"
                rows={3}
                className="w-full rounded-lg border border-hairline p-2 text-xs outline-none focus:border-accent"
              />
            </Control>

            {template.notesJa && (
              <p className="text-[11px] leading-relaxed text-ink-faint">
                {template.notesJa}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] tracking-widest text-ink-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  k,
  v,
  strong,
  hint,
}: {
  k: string;
  v: string;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <tr className={cn(strong && "text-ink")} title={hint}>
      <td className={cn("py-0.5 pr-2", hint && "underline decoration-dotted underline-offset-2")}>
        {k}
      </td>
      <td className="py-0.5 text-right">{v}</td>
    </tr>
  );
}
