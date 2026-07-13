"use client";

// The logo report — the page's core deliverable, modeled on the dial
// verification sheet: for the SELECTED logo, each art direction it has been
// generated with becomes a block of preset columns (厳密/バランス/自由),
// every result carrying its own instrument readout (dial bars, engine,
// cost, time). "計測し、見せる" as a screen, not a promise.

import { cn } from "@/lib/cn";
import {
  DIAL_AXES,
  DIAL_LABELS,
  TAXONOMY_LABELS,
  type ExpressionTemplate,
} from "@/labs/generative/core/expression-format";
import type { LogoRun, ExpressionCatalogEntry } from "@/labs/generative/core/api-types";
import { PRESET_ORDER, PRESETS, type PresetId } from "@/labs/generative/core/dials";

export default function LogoReport({
  logoName,
  runs,
  totalCostUsd,
  templates,
  onOpenTemplate,
}: {
  logoName: string;
  runs: LogoRun[];
  totalCostUsd: number;
  templates: ExpressionCatalogEntry[];
  onOpenTemplate: (id: string) => void;
}) {
  // Group this logo's runs per template, newest first (runs arrive sorted).
  const byTemplate = new Map<string, LogoRun[]>();
  for (const run of runs) {
    const list = byTemplate.get(run.templateId) ?? [];
    list.push(run);
    byTemplate.set(run.templateId, list);
  }

  const templateOf = (id: string): ExpressionTemplate | undefined =>
    templates.find((e) => e.id === id)?.template;

  return (
    <section className="mx-auto max-w-7xl px-6 pt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          {logoName} のレポート
        </h2>
        {runs.length > 0 ? (
          <p className="text-[11px] text-ink-muted">
            生成 {runs.length}回 ・ 実費 ${totalCostUsd.toFixed(3)} ・
            表現 {byTemplate.size}種(このロゴでの記録のみ表示)
          </p>
        ) : (
          <p className="text-[11px] text-ink-muted">
            まだ生成レコードがない — 下の表現テンプレートから最初の1枚をつくる
          </p>
        )}
      </div>

      {[...byTemplate.entries()].map(([templateId, templateRuns]) => (
        <TemplateBlock
          key={templateId}
          templateId={templateId}
          template={templateOf(templateId)}
          runs={templateRuns}
          onOpen={() => onOpenTemplate(templateId)}
        />
      ))}
    </section>
  );
}

function TemplateBlock({
  templateId,
  template,
  runs,
  onOpen,
}: {
  templateId: string;
  template?: ExpressionTemplate;
  runs: LogoRun[];
  onOpen: () => void;
}) {
  // Latest run per preset drives the comparison columns; the rest is history.
  const latestByPreset = new Map<PresetId, LogoRun>();
  for (const run of runs)
    if (!latestByPreset.has(run.preset)) latestByPreset.set(run.preset, run);
  const history = runs.filter(
    (r) => ![...latestByPreset.values()].some((l) => l.jobId === r.jobId),
  );

  return (
    <article className="mt-4 rounded-xl border border-hairline bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
        <h3 className="text-[13px] font-semibold tracking-tight">
          {template?.nameJa ?? templateId}
        </h3>
        <span className="text-[11px] text-ink-faint">{template?.name}</span>
        {template && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted">
            {TAXONOMY_LABELS[template.taxonomy]}
          </span>
        )}
        <span className="font-mono text-[10px] text-ink-faint">
          {runs.length}回
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto rounded-full border border-accent px-3 py-1 text-[11px] font-medium text-accent transition hover:bg-accent hover:text-white"
        >
          このロゴで生成 →
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        {PRESET_ORDER.map((preset) => {
          const run = latestByPreset.get(preset);
          return (
            <div key={preset} className="flex flex-col gap-2">
              <p className="font-mono text-[10px] tracking-widest text-ink-muted uppercase">
                {PRESETS[preset].label}
                <span className="ml-1 normal-case tracking-normal text-ink-faint">
                  {preset}
                </span>
              </p>
              {run ? <RunFigure run={run} /> : (
                <button
                  type="button"
                  onClick={onOpen}
                  className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-hairline text-[11px] text-ink-faint transition hover:border-accent hover:text-accent"
                >
                  未生成 — このプリセットで試す
                </button>
              )}
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-hairline px-4 py-2">
          <span className="shrink-0 text-[10px] text-ink-faint">履歴</span>
          {history.map((r) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={r.jobId}
              src={r.outputUrl}
              alt={`${templateId} ${PRESETS[r.preset].label}`}
              title={`${new Date(r.ts).toLocaleString()} / ${PRESETS[r.preset].label} / ${r.mock ? "モック" : r.engineUsed} / $${r.costUsd.toFixed(3)}`}
              className="h-12 w-12 shrink-0 cursor-pointer rounded border border-hairline object-cover"
              onClick={() => window.open(r.outputUrl, "_blank")}
            />
          ))}
        </div>
      )}
    </article>
  );
}

// One result with its instrument readout — image, 4-axis dials, run meta.
function RunFigure({ run }: { run: LogoRun }) {
  return (
    <figure className="m-0 flex flex-1 flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-hairline bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={run.outputUrl}
          alt=""
          className="aspect-square w-full cursor-zoom-in object-contain"
          onClick={() => window.open(run.outputUrl, "_blank")}
        />
      </div>
      <div className="flex flex-col gap-1">
        {DIAL_AXES.map((axis) => (
          <div key={axis} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-1.5">
            <span className="text-[9px] text-ink-faint">{DIAL_LABELS[axis]}</span>
            <span className="h-1 overflow-hidden rounded-full bg-ink/10">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${run.dials[axis] * 100}%` }}
              />
            </span>
            <span className="text-right font-mono text-[9px] text-ink-faint">
              {run.dials[axis].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <figcaption
        className={cn(
          "font-mono text-[9.5px]",
          run.mock ? "text-amber-600" : "text-ink-faint",
        )}
      >
        {run.mock ? "mock(キー未設定時の代替)" : run.engineUsed}
        {" ・ "}${run.costUsd.toFixed(3)}
        {" ・ "}{(run.genMs / 1000).toFixed(0)}s
        {" ・ "}{run.outWidth}×{run.outHeight}
        {" ・ "}{new Date(run.ts).toLocaleDateString()}
        {" ・ "}忠実度スコア: E2で計測
      </figcaption>
    </figure>
  );
}
