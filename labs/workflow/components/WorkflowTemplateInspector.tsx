"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import { getNote, setNote } from "@/labs/motion/core/notes-store";
import type {
  LogoColorMode,
  Template2D,
} from "@/labs/workflow/core/template-format";
import type {
  ComposeMetrics,
  ComposeOptions,
} from "@/labs/workflow/core/pipeline";
import { composeToUrl } from "@/labs/workflow/core/client";
import { templateTechNotes } from "@/labs/workflow/core/tech-notes";
import { noteKey } from "./TemplateCard";

const WIDTHS = [1024, 1600, 2048, 2600];
const COLOR_MODES: [LogoColorMode | "template", string][] = [
  ["template", "テンプレート既定"],
  ["original", "オリジナル"],
  ["mono-dark", "黒単色"],
  ["mono-light", "白単色"],
];

export default function WorkflowTemplateInspector({
  template,
  logo,
  onComposed,
}: {
  template: Template2D;
  logo: LabLogo;
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
        .then((result) => {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = result.url;
          setUrl(result.url);
          setMetrics(result.metrics);
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
  }, [template.id, logo, width, logoScale, offsetU, offsetV, colorMode, onComposed]);

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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-[28px] border border-hairline bg-white">
        <div className="border-b border-hairline px-5 py-3.5">
          <p className="font-mono text-[11px] text-ink-faint">{template.id}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-balance">
            {template.nameJa}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{template.name}</p>
        </div>

        <div className="relative flex min-h-[26rem] items-center justify-center bg-paper p-5 md:p-8">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={template.nameJa}
              className={cn(
                "max-h-[72vh] w-full object-contain transition-opacity",
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
      </section>

      <aside className="space-y-5">
        <Panel title={`ロゴサイズ ×${logoScale.toFixed(2)}`}>
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.05}
            value={logoScale}
            onChange={(e) => setLogoScale(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </Panel>

        <Panel title={`位置 U ${offsetU.toFixed(2)} / V ${offsetV.toFixed(2)}`}>
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
        </Panel>

        <Panel title="ロゴの色">
          <div className="flex flex-wrap gap-1.5">
            {COLOR_MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setColorMode(value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                  colorMode === value
                    ? "border-accent bg-accent text-white"
                    : "border-hairline text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="出力解像度">
          <div className="flex flex-wrap gap-1.5">
            {WIDTHS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setWidth(value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition",
                  width === value
                    ? "border-accent bg-accent text-white"
                    : "border-hairline text-ink-muted hover:text-ink",
                )}
              >
                {value}px
              </button>
            ))}
          </div>
        </Panel>

        {metrics && (
          <Panel title="計測(コスト原価の基礎データ)">
            <table className="w-full font-mono text-[10px] tabular-nums text-ink-muted">
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
          </Panel>
        )}

        <Panel title="技術解説(このテンプレートのパイプライン)">
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
                <p className="px-2.5 pb-2.5 text-[11px] leading-relaxed text-pretty text-ink-muted">
                  {note.body}
                </p>
              </details>
            ))}
          </div>
        </Panel>

        {url && (
          <a
            href={url}
            download={`${template.id}-${logo.name}.png`}
            className="block rounded-[20px] border border-accent px-3 py-2 text-center text-xs font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            PNGをダウンロード
          </a>
        )}

        <Panel title="研究ノート(採用判断)">
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
            rows={4}
            className="w-full rounded-xl border border-hairline p-2 text-xs outline-none focus:border-accent"
          />
        </Panel>

        {template.notesJa && (
          <Panel title="説明">
            <p className="text-sm leading-relaxed text-pretty text-ink-muted">
              {template.notesJa}
            </p>
          </Panel>
        )}
      </aside>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-hairline bg-white p-4">
      <h3 className="font-mono text-[11px] tracking-widest text-ink-muted uppercase">
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Row({
  k,
  v,
  hint,
  strong,
}: {
  k: string;
  v: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <tr className="align-top">
      <td className={cn("py-1 pr-3", strong && "text-ink")}>
        {k}
        {hint ? (
          <span className="mt-0.5 block max-w-[18rem] text-[9px] leading-relaxed text-ink-faint">
            {hint}
          </span>
        ) : null}
      </td>
      <td className={cn("py-1 text-right text-ink", strong && "font-medium")}>{v}</td>
    </tr>
  );
}
