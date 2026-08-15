"use client";

// The narrated event promo's workspace: the goal on screen, and underneath it
// what the goal is currently made of.
//
// The list below the player is not a completeness score. It answers the one
// question a user has when a finished film appears out of nothing — "where did
// all this come from?" — by showing each field's origin (§17.5). A proposal
// the tool made is labelled as one, so nobody publishes a guessed date
// believing somebody typed it.
//
// TWO BRIEFS, on purpose. `brief` is the workbench — the storyboard, the fact
// list and every edit act on it. `playing` is the film a run fixed, and it is
// the only thing the player runs. They disagree while somebody is working, and
// the notice between them says by how much rather than hiding it
// (docs/old/event-cm-refactor-plan.md §9.5).

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import {
  describeChanges,
  filmStatus,
  FILM_STEP_LABEL,
  type BakeState,
  type FilmStatus,
  type FilmStep,
} from "@/lib/event-cm/bake";
import type { BriefSource } from "./BriefSourceIntake";
import FactList, { type FactEdit } from "./FactList";
import Storyboard from "./Storyboard";
import { eventCmStoryboard } from "@/lib/storyboard/event-cm";
import {
  eventCmSceneKey,
  scenarioChars,
  scenarioStaleness,
  type EventCmBrief,
  type EventCmSceneRole,
} from "@/remotion/event-cm/types";

/** The three colours the whole screen uses (docs/video-state-model.md §3.1):
 *  amber = a change not yet in the film, green = nothing outstanding, and a
 *  quiet grey for the states that are neither. Never red — an unreflected edit
 *  is the ordinary condition of a workbench, and a red dot living there through
 *  every session teaches people to ignore the colour that means something broke. */
const STATUS_DOT: Record<FilmStatus, string> = {
  unrun: "bg-ink/25",
  behind: "bg-amber-500",
  matched: "bg-ink/25",
  settled: "bg-emerald-500",
};

const EventCmPlayer = dynamic(() => import("./EventCmPlayerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center text-[12px] text-white/50">
      プレビューを読み込み中…
    </div>
  ),
});

export default function EventCmWorkspace({
  brief,
  playing,
  bake,
  bakedAt,
  steps,
  onEditFact,
  onEditScenario,
  onDeletePanel,
  onRewriteScenario,
  imageSources = [],
  writing,
}: {
  brief: EventCmBrief;
  /** The film the player runs: what the last run fixed. */
  playing: EventCmBrief;
  /** How far `playing` is behind `brief`, and whether it exists at all. */
  bake: BakeState;
  /** When the played film was fixed. Null = never run. */
  bakedAt: string | null;
  /** What the one button would run now. Matching the storyboard and being
   *  finished are different things, and only the second one is green. */
  steps: FilmStep[];
  /** Correct a value, or switch a field off. Absent = read only. */
  onEditFact?: (edit: FactEdit) => void;
  /** Save one picture's scenario line, from the storyboard panel. */
  onEditScenario?: (
    scene: { role: EventCmSceneRole; index?: number },
    text: string,
  ) => Promise<boolean>;
  /** Remove one picture from the film, from the panel that shows it. */
  onDeletePanel?: (scene: {
    role: EventCmSceneRole;
    index?: number;
  }) => Promise<boolean>;
  /** Draft the whole scenario again. `force` replaces hand-edited lines. */
  onRewriteScenario?: (force: boolean) => void;
  /** Images pinned to this video: the candidate list for every photo slot. */
  imageSources?: BriefSource[];
  writing?: boolean;
}) {
  const goal = eventCmGoalState(brief);
  const chars = scenarioChars(brief.scenario);
  const stale = scenarioStaleness(brief);
  const storyboard = eventCmStoryboard(brief);
  const status = filmStatus(bake, steps);
  const unreflected = status === "behind";
  // When the film being played was fixed. Date and time, because two runs in
  // one afternoon is the ordinary case and a date alone would not tell them
  // apart. Absent for a take that has never been run — that branch says so.
  const playedAt = bakedAt
    ? new Date(bakedAt).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Nothing above the film.

          There used to be two lines here: the presenter and date on the left,
          the format and duration on the right. Neither belonged. The presenter
          and the date are IN the film — the closing plate says them — so
          printing them over the player is a caption on a caption, and read as
          though the tool had generated a subtitle. The format and duration are
          metadata about the file, which belongs with the other metadata under
          the title (BrandVideoDetail), not in the frame above the picture.

          A comfortable reading width even when the page is wide: a 16:9 player
          across a 2000px column is 1100px tall and pushes the storyboard
          entirely off screen. Centred, because a column with one wide object in
          it that hugs the left edge looks like a layout that failed. */}
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        {/* Dark surround because the film itself is ink-black.

            Ringed in amber while the workbench is ahead of it: the picture is
            what the user is looking at, and the whole misunderstanding this
            model exists to fix ("I changed the music and nothing happened") is
            a misunderstanding about THIS rectangle. A ring is enough — it
            frames without covering, and the line underneath says why. */}
        <div
          className={cn(
            "overflow-hidden rounded-2xl bg-[#0b0d13] p-2 shadow-sm",
            unreflected && "ring-2 ring-amber-400",
          )}
        >
          <EventCmPlayer brief={playing} />
        </div>

        {/* Which version this is, as a STATUS LINE rather than a message.

            It used to be a bordered, tinted paragraph in a sentence — which is
            the shape of an error, so a video in a perfectly ordinary state (two
            edits not yet reflected: the everyday condition of a workbench) read
            as a video with something wrong with it. The same facts as a line of
            metadata — when it was made, how many changes since, which ones —
            read as what they are. Only the change count carries colour.

            And it stands off the picture. Tucked right under the frame it read
            as part of the player rather than as a line about it. */}
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
          />
          {status === "unrun" ? (
            <span>
              下書きのまま再生中
              <span className="text-ink-faint">
                　「動画を作り直す」で読み上げが付き、尺が確定します
              </span>
            </span>
          ) : (
            <>
              <span>更新 {playedAt}</span>
              {status === "behind" ? (
                <span className="font-medium text-amber-700">
                  変更 {bake.changes.length}件（{describeChanges(bake.changes)}）
                </span>
              ) : status === "matched" ? (
                // Matching the storyboard is not the same as being finished:
                // this take plays exactly what the storyboard says AND still
                // has work in it. 最新 here would sit over a button reading
                // 未処理3件 — the two-surfaces-disagreeing bug in miniature.
                <span>
                  残りの工程 {steps.map((step) => FILM_STEP_LABEL[step]).join("・")}
                </span>
              ) : (
                // Said rather than left as the absence of a warning: "nothing
                // is complaining" and "I know this is current" are different
                // feelings, and the second is the one needed before publishing.
                <span className="font-medium text-emerald-700">最新</span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Directly under the goal: what the film is made of, picture by picture.
          The scenario used to sit here as five paragraphs of text, which said
          what would be *heard* and nothing about what would be seen. */}
      {/* The scenario and the film disagree. Two different disagreements, and
          the second one is the one that used to be invisible: a line with no
          picture to be read over is not a stale sentence, it is text the user
          wrote that the film has nowhere to put. Saying so — with the words
          still shown — is the difference between "it was deleted" and "it no
          longer has a place". */}
      {stale || storyboard.orphanLines.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          {/* Which disagreement, in the words of that disagreement. One
              sentence for both used to claim 「変わる前の内容を読み上げています」
              even when the words were current and only the set of pictures had
              changed. */}
          <p>
            {stale === "facts"
              ? "資料や項目が変わったあと、シナリオが書き直されていません。いまの映像は、変わる前の内容を語っています。"
              : "映像のコマとシナリオの行が合っていません。"}
            {storyboard.orphanLines.length > 0
              ? "いま映像に無いコマの行が残っています。"
              : null}
            {storyboard.panels.some((panel) => panel.narrated && !panel.scenario)
              ? "シナリオが書かれていないコマがあります。"
              : null}
          </p>
          {storyboard.orphanLines.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {storyboard.orphanLines.map((line) => (
                <li key={eventCmSceneKey(line)} className="text-pretty">
                  <span className="mr-2 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold">
                    使われていない行
                  </span>
                  {line.text}
                </li>
              ))}
            </ul>
          ) : null}
          {onRewriteScenario ? (
            <button
              type="button"
              onClick={() => onRewriteScenario(brief.scenario.source === "human")}
              disabled={writing}
              className="mt-3 rounded-full border border-amber-400 bg-white px-4 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:border-amber-600 disabled:opacity-50"
            >
              {writing ? "書き直しています…" : "シナリオを書き直す"}
            </button>
          ) : null}
          {brief.scenario.source === "human" ? (
            <p className="mt-1.5 text-[11px]">
              手で直した行も置き換わります。残したい言葉は先にコピーしてください。
            </p>
          ) : null}
        </div>
      ) : null}

      <Storyboard
        brief={brief}
        goalFields={goal.fields}
        busy={writing}
        onEditFact={onEditFact}
        onEditScenario={onEditScenario}
        onDeletePanel={onDeletePanel}
        imageSources={imageSources}
      />

      {brief.scenario.scenes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-4 text-[12px] text-ink-muted">
          まだシナリオがありません。いまの映像は各シーンの想定尺で並んでいます。
          シナリオを書くと尺がその文字数に合い、読み上げると実測に置き換わります。
        </p>
      ) : brief.scenario.angle ? (
        <p className="text-pretty text-[12px] text-ink-muted">
          訴求軸: {brief.scenario.angle}
          <span className="mx-1.5 text-ink-faint">・</span>
          <span className="tabular-nums">{chars}字</span>
        </p>
      ) : null}

      <section className="w-full max-w-5xl">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight">
            この動画は何でできているか
          </h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        </div>
        <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-muted">
          「仮に入れた値」は、何も聞かずにこちらで決めたものです。違えばその場で直せますし、
          出したくない項目は消せます。空の枠は欠陥ではなく、設計済みの代替で描かれています。
        </p>

        {goal.provisional.length > 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
            {goal.provisional.length}件はこちらで仮に決めた値です（
            {goal.provisional.map((field) => field.label).join("、")}）。
          </p>
        ) : null}

        {onEditFact ? (
          <FactList
            brief={brief}
            goalFields={goal.fields}
            busy={writing}
            onEdit={onEditFact}
            imageSources={imageSources}
          />
        ) : null}
      </section>
    </div>
  );
}
