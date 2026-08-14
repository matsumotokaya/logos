"use client";

// The run log kept at the bottom of every stage.
//
// The overlay card is transient by design; this is the record. A row that says
// only "読み取り 成功" answers the wrong question — what a person needs from a log
// is what went in, what came out, what it cost, and what it said when it broke.
// So the detail is everything the run recorded, verbatim, and it is copyable:
// the first thing anyone does with a log they cannot act on is paste it
// somewhere else.

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TakeRunRecord } from "@/app/api/brands/[id]/videos/[videoId]/runs/route";

const STAGE_LABEL: Record<string, string> = {
  collect: "入力",
  extract: "読み取り",
  structure: "構造化",
  map: "反映",
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
        second: "2-digit",
      });
};

const durationMs = (run: TakeRunRecord): number | null => {
  if (!run.finishedAt) return null;
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
};

const duration = (run: TakeRunRecord): string => {
  const ms = durationMs(run);
  if (ms === null) return "";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
};

/** Everything the run recorded, in the order somebody reads it. Nothing is
 *  summarised away — a log that has already decided what matters is not a log. */
function runDetail(run: TakeRunRecord): Record<string, unknown> {
  return {
    id: run.id,
    stage: run.stage,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: durationMs(run),
    error: run.error,
    input: run.input,
    steps: run.steps,
    usage: run.usage,
  };
}

const asText = (value: unknown): string => JSON.stringify(value, null, 2);

/** Small, honest, and no dependency: the clipboard API with a visible result. */
function CopyButton({
  text,
  label = "コピー",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        navigator.clipboard
          .writeText(text)
          .then(() => setState("done"))
          .catch(() => setState("failed"));
        window.setTimeout(() => setState("idle"), 2000);
      }}
      className={cn(
        "shrink-0 rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted transition hover:border-ink hover:text-ink",
        className,
      )}
    >
      {state === "done" ? "コピーしました" : state === "failed" ? "コピーできません" : label}
    </button>
  );
}

function Row({ run }: { run: TakeRunRecord }) {
  const [open, setOpen] = useState(false);
  const failed = run.status === "failed";
  const text = asText(runDetail(run));

  return (
    <li className="border-b border-hairline last:border-b-0">
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-ink/[0.02]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* An affordance, because the row was expandable and looked inert. */}
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0 text-[10px] text-ink-faint transition-transform",
              open && "rotate-90",
            )}
          >
            ▶
          </span>
          <span className="w-32 shrink-0 tabular-nums text-[11px] text-ink-faint">
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
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11px]",
              failed ? "text-red-700" : "text-ink-muted",
            )}
          >
            {run.error ?? ""}
          </span>
          <span className="shrink-0 tabular-nums text-[11px] text-ink-faint">
            {duration(run)}
          </span>
        </button>
        <CopyButton text={text} />
      </div>
      {open ? (
        <pre className="max-h-96 overflow-auto bg-[#0b0d13] px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
          {text}
        </pre>
      ) : null}
    </li>
  );
}

export default function TakeRunLog({ runs }: { runs: TakeRunRecord[] }) {
  const [allOpen, setAllOpen] = useState(false);

  return (
    <section className="mt-8">
      <div className="flex items-baseline gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          実行ログ
        </h3>
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        {runs.length > 0 ? (
          <>
            <span className="shrink-0 tabular-nums text-[11px] text-ink-faint">
              {runs.length}件
            </span>
            <button
              type="button"
              onClick={() => setAllOpen((value) => !value)}
              className="shrink-0 text-[11px] text-accent hover:underline"
            >
              {allOpen ? "全文を隠す" : "全文を表示"}
            </button>
            <CopyButton text={asText(runs.map(runDetail))} label="全部コピー" />
          </>
        ) : null}
      </div>
      {runs.length === 0 ? (
        <p className="mt-3 text-[12px] text-ink-faint">まだ実行していません</p>
      ) : allOpen ? (
        // One block rather than fifty: this is the state for reading a whole
        // session at once, or selecting it by hand.
        <pre className="mt-3 max-h-[32rem] overflow-auto rounded-xl bg-[#0b0d13] px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
          {asText(runs.map(runDetail))}
        </pre>
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
