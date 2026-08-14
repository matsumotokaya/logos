"use client";

// What the extract and structure stages actually produced.
//
// A stage that only reports "succeeded" gives a person no way to judge it.
// These read the last successful run of their own stage, so the drawer for a
// step shows the step's own output — the sources it could read, or the facts
// it worked out — and the decision about whether to carry on is informed.

import { cn } from "@/lib/cn";
import type { TakeRunRecord } from "@/app/api/brands/[id]/videos/[videoId]/runs/route";

interface ExtractedSourceRow {
  label: string;
  mediaType: string;
  mode: "text" | "passthrough" | "skipped";
  chars: number;
  note?: string;
}

const MODE_LABEL: Record<ExtractedSourceRow["mode"], string> = {
  text: "読み取り済み",
  passthrough: "構造化で直接読む",
  skipped: "対象外",
};

const MODE_STYLE: Record<ExtractedSourceRow["mode"], string> = {
  text: "border-emerald-200 bg-emerald-50 text-emerald-700",
  passthrough: "border-hairline bg-ink/[0.03] text-ink-muted",
  skipped: "border-hairline bg-ink/[0.03] text-ink-faint",
};

const lastRun = (runs: TakeRunRecord[], stage: string): TakeRunRecord | null =>
  runs.find((run) => run.stage === stage && run.status === "succeeded") ?? null;

export function ExtractResults({ runs }: { runs: TakeRunRecord[] }) {
  const run = lastRun(runs, "extract");
  const rows = (run?.steps as ExtractedSourceRow[] | null) ?? [];

  if (!run) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-ink">抽出ステージの結果</h3>
        <p className="text-[12px] text-ink-muted">
          まだ読み取っていません。上の登録資料を入れてから実行してください。
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-ink">抽出ステージの結果</h3>
        <p className="mt-1 text-[11px] text-ink-muted">
          上の登録資料を、次の構造化ステージへどう渡したかを表示しています。
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li
            key={`${row.label}-${i}`}
            className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
          >
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                MODE_STYLE[row.mode],
              )}
            >
              {MODE_LABEL[row.mode]}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{row.label}</span>
            <span className="shrink-0 tabular-nums text-[11px] text-ink-faint">
              {row.mode === "text" ? `${row.chars}字` : (row.note ?? "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Facts the structuring run read out of the material. `null` = not stated. */
type Facts = Record<string, unknown> & { note?: string | null };

const FACT_LABEL: Record<string, string> = {
  title: "イベント名",
  subtitle: "サブタイトル",
  seriesLabel: "シリーズ・回次",
  presenter: "主催",
  valueLines: "訴求",
  valueChip: "訴求の一言",
  programs: "プログラム",
  guests: "登壇者",
  date: "開催日",
  weekday: "曜日",
  time: "開始時刻",
  venue: "会場",
  fee: "参加費",
  cta: "行動喚起",
  footnote: "注記",
};

const preview = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "name" in item
          ? String((item as { name: unknown }).name)
          : String(item),
      )
      .join("、");
  }
  return String(value);
};

export function StructureResults({ runs }: { runs: TakeRunRecord[] }) {
  const run = lastRun(runs, "structure");
  const steps = run?.steps as { facts?: Facts; read?: string[] } | null;
  const facts = steps?.facts;

  if (!facts) {
    return (
      <p className="text-[12px] text-ink-muted">
        まだ構造化していません。資料を読み取ってから実行してください。
      </p>
    );
  }

  const found = Object.entries(facts).filter(
    ([key, value]) => key !== "note" && value !== null && value !== undefined,
  );
  const missing = Object.entries(facts).filter(
    ([key, value]) => key !== "note" && (value === null || value === undefined),
  );

  return (
    <div className="flex flex-col gap-4">
      {steps?.read?.length ? (
        <p className="text-[11px] text-ink-faint">読んだ資料: {steps.read.join("、")}</p>
      ) : null}
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          資料に書かれていたこと（{found.length}件）
        </h4>
        <ul className="mt-2 flex flex-col gap-1">
          {found.map(([key, value]) => (
            <li key={key} className="flex gap-3 text-[13px]">
              <span className="w-28 shrink-0 text-ink-muted">
                {FACT_LABEL[key] ?? key}
              </span>
              <span className="min-w-0 flex-1 text-ink">{preview(value)}</span>
            </li>
          ))}
        </ul>
      </div>
      {missing.length > 0 ? (
        <p className="text-[11px] text-ink-faint">
          資料に無かった項目（{missing.length}件）:{" "}
          {missing.map(([key]) => FACT_LABEL[key] ?? key).join("、")}
          。これらは仮の値のまま残ります。
        </p>
      ) : null}
      {facts.note ? (
        <p className="rounded-xl border border-hairline bg-ink/[0.03] px-3 py-2 text-[12px] text-ink-muted">
          読み取りメモ: {facts.note}
        </p>
      ) : null}
    </div>
  );
}
