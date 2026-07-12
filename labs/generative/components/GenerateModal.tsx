"use client";

// Fullscreen inspector for one art direction: preset dial, context input,
// live prompt preview (the exact string that will run — showing the harness
// is the product), explicit paid generation, result + meta readout, and the
// adopt/drop research note. Plain fixed overlay, not <dialog> — React
// onChange misfires inside showModal (see project memory).

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import { getNote, setNote } from "@/labs/motion/core/notes-store";
import {
  DIAL_AXES,
  DIAL_LABELS,
  TAXONOMY_LABELS,
  type ExpressionTemplate,
} from "@/labs/generative/core/expression-format";
import type {
  EngineStatusDto,
  GenerateMeta,
  RecentGenJob,
} from "@/labs/generative/core/api-types";
import {
  PRESET_ORDER,
  PRESETS,
  resolveDials,
  type PresetId,
} from "@/labs/generative/core/dials";
import { mapDialsToParams } from "@/labs/generative/core/mapping";
import { assemblePrompt, MAX_CONTEXT_CHARS } from "@/labs/generative/core/prompt";
import { generate } from "@/labs/generative/core/client";
import { noteKey } from "./ExpressionCard";

export default function GenerateModal({
  template,
  engines,
  logo,
  recent,
  onClose,
  onGenerated,
}: {
  template: ExpressionTemplate;
  engines: EngineStatusDto[];
  logo: LabLogo;
  recent: RecentGenJob[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [preset, setPreset] = useState<PresetId>("balanced");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateMeta | null>(null);

  const [rating, setRating] = useState(() => getNote(noteKey(template.id)).rating);
  const [memo, setMemo] = useState(() => getNote(noteKey(template.id)).note);

  const engine = engines.find((e) => e.id === template.engine);
  const willMock = !engine?.available;

  const dials = useMemo(() => resolveDials(preset, template), [preset, template]);
  const params = useMemo(
    () => mapDialsToParams(template.engine, dials, template),
    [template, dials],
  );
  const palette = useMemo(
    () => logo.colors.slice(0, 6).map((c) => c.hex),
    [logo],
  );
  const preview = useMemo(
    () => assemblePrompt(template, dials, context, palette),
    [template, dials, context, palette],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = useCallback(() => {
    setBusy(true);
    setError(null);
    generate(template.id, logo, preset, context)
      .then((meta) => {
        setResult(meta);
        setBusy(false);
        onGenerated();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "生成に失敗");
        setBusy(false);
        onGenerated(); // 失敗もコスト計測に載るため集計を更新する
      });
  }, [template.id, logo, preset, context, onGenerated]);

  const saveNote = useCallback(
    (nextRating: number, nextMemo: string) => {
      setRating(nextRating);
      setMemo(nextMemo);
      setNote(noteKey(template.id), { rating: nextRating, note: nextMemo });
    },
    [template.id],
  );

  const shown = result?.output.url ?? recent[0]?.outputUrl ?? null;

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
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted">
            {TAXONOMY_LABELS[template.taxonomy]}
          </span>
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

        <div className="grid flex-1 gap-0 overflow-auto lg:grid-cols-[1fr_320px]">
          <div className="relative flex flex-col bg-paper">
            <div className="flex flex-1 items-center justify-center p-4">
              {error ? (
                <p className="max-w-md text-sm leading-relaxed text-red-600">{error}</p>
              ) : shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shown}
                  alt={template.nameJa}
                  className={cn(
                    "max-h-[62vh] w-full rounded-lg object-contain transition-opacity",
                    busy && "opacity-50",
                  )}
                />
              ) : (
                <p className="max-w-sm py-24 text-center text-sm leading-relaxed text-ink-muted">
                  まだ生成していない。右のプリセットを選んで「生成する」——
                  探索モードは実費がかかるため、自動では走らない。
                </p>
              )}
              {busy && (
                <span className="absolute right-6 top-6 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] text-white">
                  生成中…(数十秒かかることがある)
                </span>
              )}
            </div>

            {result && (
              <div className="border-t border-hairline bg-white/70 px-4 py-2 font-mono text-[10px] text-ink-muted">
                {result.mock ? (
                  <span className="text-amber-600">
                    モック生成({result.engineRequested} のAPIキー未設定・ロゴはサーバー外に出ていない)
                  </span>
                ) : (
                  <span>engine: {result.engineUsed}</span>
                )}
                {" ・ "}${result.costUsd.toFixed(3)}
                {" ・ "}{(result.genMs / 1000).toFixed(1)}s
                {" ・ "}{result.output.width}×{result.output.height}px
                {" ・ "}逸脱スコア: Phase E2で計測
              </div>
            )}

            {recent.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-t border-hairline bg-white/70 px-4 py-2">
                {recent.map((j) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={j.jobId}
                    src={j.outputUrl}
                    alt={`${j.templateId} (${j.preset})`}
                    title={`${new Date(j.ts).toLocaleString()} / ${PRESETS[j.preset].label} / ${j.mock ? "モック" : j.engineUsed} / $${j.costUsd.toFixed(3)}`}
                    className="h-14 w-14 shrink-0 cursor-pointer rounded border border-hairline object-cover"
                    onClick={() => window.open(j.outputUrl, "_blank")}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-5 border-t border-hairline p-5 lg:border-t-0 lg:border-l">
            <Control label="逸脱ダイヤル(プリセット)">
              <div className="flex gap-1.5">
                {PRESET_ORDER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={cn(
                      "flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition",
                      preset === p
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-ink-muted hover:text-ink",
                    )}
                  >
                    {PRESETS[p].label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-ink-faint">
                {PRESETS[preset].descriptionJa}
              </p>
              <div className="space-y-1.5 pt-1">
                {DIAL_AXES.map((axis) => {
                  const lock = template.dials?.locks?.[axis];
                  return (
                    <div key={axis} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-[10px] text-ink-muted">
                        {DIAL_LABELS[axis]}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className={cn("h-full", lock ? "bg-ink-faint" : "bg-accent")}
                          style={{ width: `${dials[axis] * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                        {lock ? "🔒" : dials[axis].toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                {Object.entries(template.dials?.locks ?? {}).map(([axis, lock]) =>
                  lock?.reasonJa ? (
                    <p key={axis} className="text-[10px] leading-relaxed text-ink-faint">
                      🔒 {DIAL_LABELS[axis as (typeof DIAL_AXES)[number]]}: {lock.reasonJa}
                    </p>
                  ) : null,
                )}
                <p className="text-[10px] text-ink-faint">
                  4軸の個別調整は Phase E3(詳細展開UI)で開く
                </p>
              </div>
            </Control>

            <Control label={`ブランド文脈(任意・${MAX_CONTEXT_CHARS}字まで)`}>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="業種・キーワード(例: 山岳ガイドサービス)"
                className="w-full rounded-lg border border-hairline p-2 text-xs outline-none focus:border-accent"
              />
              <p className="text-[10px] leading-relaxed text-ink-faint">
                入力はそのままモデルへは渡らない——無害化してテンプレートの骨格にラップされる
              </p>
            </Control>

            <Control label="実行プロンプト(これがそのまま送られる)">
              <p className="max-h-32 overflow-auto rounded-lg bg-ink/5 p-2.5 font-mono text-[10px] leading-relaxed text-ink-muted">
                {preview.prompt}
              </p>
              <div className="font-mono text-[10px] text-ink-faint">
                {template.engine === "recraft" && (
                  <span>strength {params.strength} / style {params.style}</span>
                )}
                {template.engine === "flux2" && (
                  <span>guidance {params.guidanceScale} / steps {params.steps}</span>
                )}
              </div>
            </Control>

            <button
              type="button"
              onClick={run}
              disabled={busy}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-center text-xs font-medium transition",
                busy
                  ? "cursor-wait bg-ink/10 text-ink-faint"
                  : "bg-accent text-white hover:opacity-90",
              )}
            >
              {busy
                ? "生成中…"
                : willMock
                  ? "モックで生成する($0.00 — APIキー未設定)"
                  : `生成する(実費 目安 $${engine?.costPerImageUsd.toFixed(3)})`}
            </button>
            {willMock && (
              <p className="text-[10px] leading-relaxed text-amber-600">
                {engine?.name ?? template.engine} のAPIキーが未設定のため、決定論的モックで代替する。
                .env.local に {template.engine === "flux2" ? "TOGETHER_API_KEY" : "RECRAFT_API_KEY"} を設定すると実エンジンに切り替わる(再起動不要)
              </p>
            )}

            {result && (
              <a
                href={result.output.url}
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
                placeholder="所感・成功率・採用可否のメモ"
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
