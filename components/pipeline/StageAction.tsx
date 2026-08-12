"use client";

// The one action a stage offers: the step that carries the work into the next
// stage.
//
// A stage is a state; its action is the transition out of it. So the input
// drawer offers reading, the reading drawer offers structuring, and the
// structuring drawer offers putting the result into the film. Stacking every
// step's button in one drawer — which is what "② 読み取る / ③ 反映する" was —
// makes the numbers do the explaining, and numbers explain nothing.
//
// Running everything at once is not part of this. It belongs outside the flow,
// as a single control over the whole pipeline (see RunAllButton).

import type { PipelineStageId } from "@/lib/pipeline/stages";
import type { RunnableStage } from "@/app/api/brands/[id]/videos/[videoId]/run/[stage]/route";

/** Which step each stage hands off to, and what to call it. */
const NEXT_STEP: Partial<Record<PipelineStageId, { stage: RunnableStage; label: string }>> = {
  input: { stage: "extract", label: "資料を読み取る" },
  extract: { stage: "structure", label: "内容を構造化する" },
  structure: { stage: "map", label: "動画へ反映する" },
};

export default function StageAction({
  stageId,
  busy,
  disabled,
  onRun,
  onRewriteScript,
}: {
  stageId: PipelineStageId;
  busy: boolean;
  /** No material yet: there is nothing for any of these steps to work on. */
  disabled: boolean;
  onRun: (stage: RunnableStage) => void;
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
  const next = NEXT_STEP[stageId];
  if (!next) return null;

  return (
    <div className="flex items-center gap-3">
      {stageId === "structure" && onRewriteScript ? (
        <button
          type="button"
          onClick={onRewriteScript}
          disabled={busy}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          ナレーションだけ書き直す
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onRun(next.stage)}
        disabled={busy || disabled}
        className="rounded-full border border-ink px-5 py-2 text-xs font-semibold transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-transparent"
      >
        {busy ? "実行中…" : next.label} →
      </button>
    </div>
  );
}
