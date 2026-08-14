"use client";

// The narrated event promo's workspace: the goal on screen, and underneath it
// what the goal is currently made of.
//
// The list below the player is not a completeness score. It answers the one
// question a user has when a finished film appears out of nothing — "where did
// all this come from?" — by showing each field's origin (§17.5). A proposal
// the tool made is labelled as one, so nobody publishes a guessed date
// believing somebody typed it.

import dynamic from "next/dynamic";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import type { BriefSource } from "./BriefSourceIntake";
import FactList, { type FactEdit } from "./FactList";
import Storyboard from "./Storyboard";
import { eventCmStoryboard } from "@/lib/storyboard/event-cm";
import {
  scriptChars,
  scriptStaleness,
  type EventCmBrief,
  type EventCmSceneRole,
} from "@/remotion/event-cm/types";

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
  onEditFact,
  onEditNarration,
  onDeletePanel,
  onRewriteScript,
  imageSources = [],
  writing,
}: {
  brief: EventCmBrief;
  /** Correct a value, or switch a field off. Absent = read only. */
  onEditFact?: (edit: FactEdit) => void;
  /** Save one picture's narration line, from the storyboard panel. */
  onEditNarration?: (
    scene: { role: EventCmSceneRole; index?: number },
    text: string,
  ) => Promise<boolean>;
  /** Remove one picture from the film, from the panel that shows it. */
  onDeletePanel?: (scene: {
    role: EventCmSceneRole;
    index?: number;
  }) => Promise<boolean>;
  /** Draft the whole narration again. `force` replaces hand-edited lines. */
  onRewriteScript?: (force: boolean) => void;
  /** Images pinned to this video: the candidate list for every photo slot. */
  imageSources?: BriefSource[];
  writing?: boolean;
}) {
  const goal = eventCmGoalState(brief);
  const chars = scriptChars(brief.script);
  const stale = scriptStaleness(brief);
  const storyboard = eventCmStoryboard(brief);

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
      <div className="mx-auto w-full max-w-5xl">
        {/* Dark surround because the film itself is ink-black. */}
        <div className="overflow-hidden rounded-2xl bg-[#0b0d13] p-2 shadow-sm">
          <EventCmPlayer brief={brief} />
        </div>
      </div>

      {/* Directly under the goal: what the film is made of, picture by picture.
          The narration used to sit here as five paragraphs of text, which said
          what would be *heard* and nothing about what would be seen. */}
      {/* The narration and the film disagree. Two different disagreements, and
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
              ? "資料や項目が変わったあと、ナレーションが書き直されていません。いまの映像は、変わる前の内容を読み上げています。"
              : "映像のコマとナレーションの行が合っていません。"}
            {storyboard.orphanLines.length > 0
              ? "いま映像に無いコマの行が残っています。"
              : null}
            {storyboard.panels.some((panel) => panel.narrated && !panel.narration)
              ? "読み上げる言葉が無いコマがあります。"
              : null}
          </p>
          {storyboard.orphanLines.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {storyboard.orphanLines.map((line) => (
                <li key={`${line.role}#${line.index ?? ""}`} className="text-pretty">
                  <span className="mr-2 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold">
                    使われていない行
                  </span>
                  {line.text}
                </li>
              ))}
            </ul>
          ) : null}
          {onRewriteScript ? (
            <button
              type="button"
              onClick={() => onRewriteScript(brief.script.source === "human")}
              disabled={writing}
              className="mt-3 rounded-full border border-amber-400 bg-white px-4 py-1.5 text-[11px] font-semibold text-amber-900 transition hover:border-amber-600 disabled:opacity-50"
            >
              {writing ? "書き直しています…" : "台本を書き直す"}
            </button>
          ) : null}
          {brief.script.source === "human" ? (
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
        onEditNarration={onEditNarration}
        onDeletePanel={onDeletePanel}
        imageSources={imageSources}
      />

      {brief.script.scenes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-4 text-[12px] text-ink-muted">
          まだ台本がありません。いまの映像は各シーンの想定尺で並んでいます。
          台本を書くと尺がその文字数に合い、読み上げると実測に置き換わります。
        </p>
      ) : brief.script.angle ? (
        <p className="text-pretty text-[12px] text-ink-muted">
          訴求軸: {brief.script.angle}
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
