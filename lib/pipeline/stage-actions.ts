// What a pipeline drawer lets you press, and what it says when it does not.
//
// The same shape as lib/brand-tree-actions.ts and lib/event-cm/panel-actions.ts:
// the decision is data, tested here, and the component only draws it. A button
// that is disabled for the wrong reason is invisible in a screenshot and obvious
// in a test — and this file exists because one of them was: `disabled` meant
// "no material has been added", which is a real reason not to read anything and
// no reason at all not to write a narration. A freshly seeded video has no
// documents by design (§9.9), so the film step has to stay pressable.
//
// Two buttons per drawer, at most:
//   own      the work this stage does in place, while it has something new
//   advance  the step OUT of this stage, which runs the next stage's work and
//            opens its drawer — so progress appears where the work happens
//
// The chain is input → structure → map → film. The last link is not a stage of
// `run/[stage]`: it is the narration, the reading aloud and the fixing, three
// endpoints the page owns. So `run: "film"` hands the work back to the page and
// this file only decides whether there is any (§9.6).

import { FILM_STEP_LABEL, type FilmStep } from "@/lib/event-cm/bake";
import type { PipelineStage, PipelineStageId } from "@/lib/pipeline/stages";
import type { RunnableStage } from "@/app/api/brands/[id]/videos/[videoId]/run/[stage]/route";

/** What the last link runs. Not a `RunnableStage` — see the file header. */
export type StageRun = RunnableStage | "film";

export interface StageButton {
  run: StageRun;
  label: string;
  enabled: boolean;
  /** Why not, in the user's words. Null when enabled. */
  reason: string | null;
}

export interface StageAdvanceButton extends StageButton {
  /** The drawer to open before running. */
  to: PipelineStageId;
}

export interface StageActions {
  own: StageButton | null;
  advance: StageAdvanceButton | null;
}

const OWN: Partial<Record<PipelineStageId, { run: RunnableStage; label: string }>> = {
  input: { run: "extract", label: "入力・抽出を実行" },
};

const ADVANCE: Partial<
  Record<PipelineStageId, { to: PipelineStageId; run: StageRun; label: string }>
> = {
  input: { to: "structure", run: "structure", label: "構造化して反映する" },
  structure: { to: "map", run: "map", label: "動画へ反映する" },
  map: { to: "output", run: "film", label: "動画にする" },
};

export function stageActions(input: {
  stageId: PipelineStageId;
  /** Every stage's freshness. Both buttons are decided from it. */
  stages: PipelineStage[];
  /** Whether anything has been pinned to read. Only the reading steps care. */
  hasMaterial: boolean;
  /**
   * What the film step would do, from `pendingFilmSteps`.
   *
   * Null for a template with no fixing step (product-cm, event-promo): the chain
   * ends at the mapping, so that drawer offers nothing rather than a button that
   * would call nothing. An empty array means the played film already says
   * everything the workbench holds.
   */
  filmSteps: FilmStep[] | null;
}): StageActions {
  const here = input.stages.find((stage) => stage.id === input.stageId);
  const own = OWN[input.stageId];
  const declared = ADVANCE[input.stageId];
  const advance = declared?.run === "film" && input.filmSteps === null ? undefined : declared;

  return {
    own: own
      ? {
          ...own,
          // Nothing new to read: the last run already covers everything supplied.
          enabled: input.hasMaterial && here?.status !== "ready",
          reason: !input.hasMaterial
            ? "先に資料かテキストを追加してください"
            : here?.status === "ready"
              ? "すべて読み取り済みです"
              : null,
        }
      : null,
    advance: advance ? advanceButton(advance, here, input) : null,
  };
}

function advanceButton(
  advance: { to: PipelineStageId; run: StageRun; label: string },
  here: PipelineStage | undefined,
  input: { stages: PipelineStage[]; hasMaterial: boolean; filmSteps: FilmStep[] | null },
): StageAdvanceButton {
  const next = input.stages.find((stage) => stage.id === advance.to);
  const film = advance.run === "film";
  const steps = input.filmSteps ?? [];

  // "Already current" is a different question for the film.
  //
  // A stage is current when its run is newer than its input. A film can be fixed
  // and still owe work: a recording the narration has outrun is not a stale
  // stage, it is a step nobody has taken. So the film asks the steps.
  const done = film ? steps.length === 0 : next?.status === "ready";
  // The step consumes this stage's output, so a stale stage blocks it — fixing a
  // film whose facts have not been applied fixes the wrong film.
  const waiting = here?.status !== "ready";
  // Material gates the reading steps only. The film half runs on the brief,
  // which every take has from its first second.
  const needsMaterial = !film && !input.hasMaterial;

  return {
    to: advance.to,
    run: advance.run,
    // Says the things it would do, in the words the rest of the page uses for
    // them. One fixed label would be wrong whenever only one step is left.
    label:
      film && steps.length > 0
        ? steps.map((step) => FILM_STEP_LABEL[step]).join("・")
        : advance.label,
    enabled: !needsMaterial && !waiting && !done,
    reason: needsMaterial
      ? "先に資料かテキストを追加してください"
      : done
        ? film
          ? "この動画に反映済みです"
          : `${advance.label}は反映済みです`
        : waiting
          ? `${here?.label ?? "前の段"}が最新になると実行できます`
          : null,
  };
}
