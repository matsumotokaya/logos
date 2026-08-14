"use client";

// What a stage lets you do: its own work, and the step into the next stage.
//
// The API still keeps each stage separate so every result is traceable. The
// input-stage shortcut may chain structure -> map in the page, because a user
// asking to structure new material expects the storyboard to update as well.
//
// The explicit map-stage action remains available for re-running application
// without calling the model again.
//
// Running everything at once still belongs outside the flow, as a single
// control over the whole pipeline (see the "まとめて実行" button).

import type { PipelineStage, PipelineStageId } from "@/lib/pipeline/stages";
import type { RunnableStage } from "@/app/api/brands/[id]/videos/[videoId]/run/[stage]/route";

/** The work a stage does in place, re-runnable while it has something new. */
const OWN_STEP: Partial<Record<PipelineStageId, { run: RunnableStage; label: string }>> = {
  input: { run: "extract", label: "入力・抽出を実行" },
};

/** The step out of a stage: what it runs, and where it takes you. */
const ADVANCE: Partial<
  Record<PipelineStageId, { to: PipelineStageId; run: RunnableStage; label: string }>
> = {
  input: { to: "structure", run: "structure", label: "構造化して反映する" },
  structure: { to: "map", run: "map", label: "動画へ反映する" },
};

export default function StageAction({
  stageId,
  stages,
  busy,
  disabled,
  onRun,
  onOpenStage,
  onRewriteScript,
}: {
  stageId: PipelineStageId;
  /** Every stage's freshness — what decides whether either button has work. */
  stages: PipelineStage[];
  busy: boolean;
  /** No material yet: there is nothing for any of these steps to work on. */
  disabled: boolean;
  onRun: (stage: RunnableStage) => void;
  /** Open another stage's drawer. The advance button uses it before running,
   *  so the progress appears where the work is happening. */
  onOpenStage: (stage: PipelineStageId) => void;
  /**
   * Rewrite the narration without re-reading anything.
   *
   * Offered on the structuring stage because that is where the words are
   * decided. Applying facts already rewrites the narration; this is for
   * wanting a different take on the same facts, which is the commonest reason
   * to touch a script at all.
   */
  onRewriteScript?: () => void;
}) {
  const own = OWN_STEP[stageId];
  const advance = ADVANCE[stageId];
  if (!own && !advance) return null;

  const here = stages.find((stage) => stage.id === stageId);
  const next = advance
    ? stages.find((stage) => stage.id === advance.to)
    : undefined;
  // Nothing new to read: the last run already covers everything supplied.
  const ownDone = here?.status === "ready";
  // The next step consumes this stage's output, so it waits for it. It also
  // becomes unavailable once that next step is already current; a completed
  // pipeline should not offer a button that merely repeats the same work.
  const advanceDone = next?.status === "ready";
  const advanceBlocked = Boolean(advance) &&
    (here?.status !== "ready" || advanceDone);

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {stageId === "structure" && onRewriteScript ? (
        <button
          type="button"
          onClick={onRewriteScript}
          disabled={busy}
          className="mr-auto text-xs text-accent hover:underline disabled:opacity-50"
        >
          ナレーションだけ書き直す
        </button>
      ) : null}

      {own ? (
        <>
          <span className="text-[11px] text-ink-faint">
            {disabled
              ? "先に資料かテキストを追加してください"
              : ownDone
                ? "すべて読み取り済みです"
                : ""}
          </span>
          <button
            type="button"
            onClick={() => onRun(own.run)}
            disabled={busy || disabled || ownDone}
            className="rounded-full border border-hairline px-5 py-2 text-xs font-semibold transition hover:border-ink disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:border-hairline"
          >
            {busy ? "実行中…" : own.label}
          </button>
        </>
      ) : null}

      {advance ? (
        <>
          {advanceBlocked ? (
            <span className="text-[11px] text-ink-faint">
              {advanceDone
                ? `${advance.label}は反映済みです`
                : `${here?.label ?? "前の段"}が最新になると実行できます`}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              // Open first, then run: the same order the studio uses, so the
              // progress shows up in the stage that is doing the work rather
              // than in the one you just left.
              onOpenStage(advance.to);
              onRun(advance.run);
            }}
            disabled={busy || disabled || advanceBlocked}
            className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-hairline disabled:text-ink-faint"
          >
            {advance.label} →
          </button>
        </>
      ) : null}
    </div>
  );
}
