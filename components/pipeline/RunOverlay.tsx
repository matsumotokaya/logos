"use client";

// The bottom-right card that says what a stage run is doing.
//
// Modelled on slide-factory's JobOverlay, and for the same reason: pressing a
// button that takes thirty seconds and shows nothing is indistinguishable from
// pressing a button that does nothing.
//
// The dismissal rule carries the meaning. A success takes itself off the
// screen after ten seconds — it worked, the result is already visible in the
// stage — while a failure stays until it is closed, because an error nobody
// read is an error that will be hit again. Either way the full record stays in
// the run log at the bottom of the drawer.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type RunStatus = "running" | "succeeded" | "failed";

export interface RunCard {
  id: string;
  label: string;
  status: RunStatus;
  lines: string[];
  error?: string | null;
  startedAt: number;
  endedAt: number | null;
}

const SUCCESS_DISMISS_MS = 10_000;

function elapsedLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}分${seconds % 60}秒` : `${seconds}秒`;
}

/** Ticks while running so a long job visibly keeps moving; freezes when done. */
function useElapsed(startedAt: number, endedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endedAt]);
  return elapsedLabel((endedAt ?? now) - startedAt);
}

function Card({ run, onDismiss }: { run: RunCard; onDismiss: () => void }) {
  const logRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(run.startedAt, run.endedAt);
  const running = run.status === "running";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [run.lines.length]);

  useEffect(() => {
    if (run.status !== "succeeded") return;
    const timer = setTimeout(onDismiss, SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [run.status, onDismiss]);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-hairline bg-ink/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {running ? (
            <span className="inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          ) : null}
          <span className="truncate text-xs font-semibold text-ink">{run.label}</span>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "text-xs font-semibold",
              running
                ? "text-ink-muted"
                : run.status === "succeeded"
                  ? "text-emerald-700"
                  : "text-red-700",
            )}
          >
            {running ? "実行中" : run.status === "succeeded" ? "完了" : "失敗"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-[11px] text-ink-muted">{elapsed}</span>
          {!running ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="この実行の表示を閉じる"
              className="rounded px-1.5 py-0.5 text-xs leading-none text-ink-faint hover:bg-ink/5 hover:text-ink"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {run.status === "failed" && run.error ? (
        <div className="border-b border-hairline bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          エラー: {run.error}
        </div>
      ) : null}

      <div
        ref={logRef}
        className="max-h-40 space-y-0.5 overflow-y-auto bg-[#0b0d13] px-3 py-2 font-mono text-[11px] leading-relaxed text-white/80"
      >
        {run.lines.length === 0 && running ? (
          <div className="text-white/40">開始しています…</div>
        ) : null}
        {run.lines.map((line, i) => (
          <div key={`${line}-${i}`}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export default function RunOverlay({
  runs,
  onDismiss,
}: {
  runs: RunCard[];
  onDismiss: (id: string) => void;
}) {
  if (runs.length === 0) return null;
  return (
    // Above the stage drawer, so a run stays readable while a stage is open.
    <div className="fixed bottom-4 right-4 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {runs.map((run) => (
        <Card key={run.id} run={run} onDismiss={() => onDismiss(run.id)} />
      ))}
    </div>
  );
}
