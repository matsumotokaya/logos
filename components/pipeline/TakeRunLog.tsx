"use client";

// The run log kept at the bottom of every stage.
//
// The overlay card is transient by design; this is the record. Each row opens
// to show what the run actually produced — the extraction's per-source counts,
// the structuring's applied fields — because "it succeeded" is not an answer
// to "what did it change".

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TakeRunRecord } from "@/app/api/brands/[id]/videos/[videoId]/runs/route";

const STAGE_LABEL: Record<string, string> = {
  collect: "入力",
  extract: "読み取り",
  structure: "構造化",
  render: "書き出し",
  publish: "公開",
};

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const duration = (run: TakeRunRecord): string => {
  if (!run.finishedAt) return "";
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
};

function Row({ run }: { run: TakeRunRecord }) {
  const [open, setOpen] = useState(false);
  const failed = run.status === "failed";

  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink/[0.02]"
      >
        <span className="w-24 shrink-0 tabular-nums text-[11px] text-ink-faint">
          {formatTime(run.startedAt)}
        </span>
        <span className="w-16 shrink-0 text-[12px] text-ink">
          {STAGE_LABEL[run.stage] ?? run.stage}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            failed
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {failed ? "失敗" : "成功"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          {run.error ?? ""}
        </span>
        <span className="shrink-0 tabular-nums text-[11px] text-ink-faint">
          {duration(run)}
        </span>
      </button>
      {open ? (
        <pre className="max-h-64 overflow-auto bg-[#0b0d13] px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
          {JSON.stringify({ steps: run.steps, usage: run.usage }, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

export default function TakeRunLog({ runs }: { runs: TakeRunRecord[] }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          実行ログ
        </h3>
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
      </div>
      {runs.length === 0 ? (
        <p className="mt-3 text-[12px] text-ink-faint">まだ実行していません</p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-xl border border-hairline bg-white">
          {runs.map((run) => (
            <Row key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}
