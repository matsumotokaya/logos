"use client";

// The pipeline that completes one deliverable, sitting above it. Every
// deliverable screen gets one (deliverable-architecture §17.3): the goal stays
// on screen, and a stage opens over it rather than replacing it.

import { cn } from "@/lib/cn";
import type { PipelineStage, PipelineStageStatus } from "@/lib/pipeline/stages";

const STATUS_DOT: Record<PipelineStageStatus, string> = {
  empty: "bg-hairline",
  ready: "bg-emerald-500",
  stale: "bg-amber-500",
};

const STATUS_LABEL: Record<PipelineStageStatus, string> = {
  empty: "未実行",
  ready: "最新",
  stale: "要更新",
};

export default function PipelineBar({
  stages,
  openStage,
  onOpenStage,
}: {
  stages: PipelineStage[];
  openStage: string | null;
  onOpenStage: (id: string | null) => void;
}) {
  return (
    <nav
      aria-label="パイプライン"
      className="flex gap-2 overflow-x-auto border-b border-hairline bg-paper px-6 py-3"
    >
      {stages.map((stage, index) => {
        const open = stage.id === openStage;
        return (
          <button
            key={stage.id}
            type="button"
            // Re-pressing the open stage closes it, so the bar is a toggle
            // rather than a place you can get stuck inside.
            onClick={() => onOpenStage(open ? null : stage.id)}
            aria-expanded={open}
            className={cn(
              "flex min-w-[9.5rem] flex-1 flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
              open
                ? "border-accent bg-accent/5"
                : "border-hairline hover:border-ink/40",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-ink-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium text-ink">{stage.label}</span>
              <span
                aria-label={STATUS_LABEL[stage.status]}
                title={STATUS_LABEL[stage.status]}
                className={cn(
                  "ml-auto size-2 shrink-0 rounded-full",
                  STATUS_DOT[stage.status],
                )}
              />
            </span>
            <span className="text-xs text-ink-muted">{stage.summary}</span>
          </button>
        );
      })}
    </nav>
  );
}
