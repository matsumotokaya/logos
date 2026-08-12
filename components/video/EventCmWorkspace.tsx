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
import { cn } from "@/lib/cn";
import { eventCmGoalState } from "@/lib/pipeline/event-cm";
import { DEFAULT_ASSETS } from "@/lib/assets/defaults";
import type { BriefSource } from "./BriefSourceIntake";
import FactList, { type FactEdit } from "./FactList";
import { eventCmTimeline, type TimingSource } from "@/remotion/event-cm/timeline";
import { scriptChars, scriptIsStale, type EventCmBrief } from "@/remotion/event-cm/types";

const EventCmPlayer = dynamic(() => import("./EventCmPlayerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center text-[12px] text-white/50">
      プレビューを読み込み中…
    </div>
  ),
});

const TIMING_LABEL: Record<TimingSource, string> = {
  budget: "各シーンの想定尺（台本がまだありません）",
  script: "台本の文字数からの推定",
  voice: "読み上げ音声の実測",
};

export default function EventCmWorkspace({
  brief,
  onEditFact,
  audioSources = [],
  writing,
}: {
  brief: EventCmBrief;
  /** Correct a value, or switch a field off. Absent = read only. */
  onEditFact?: (edit: FactEdit) => void;
  /**
   * Audio the user uploaded as briefing material.
   *
   * The app cannot tell music from narration from a sound effect, and does not
   * try: whatever a person points at here is what the film plays. Marking it
   * IS the classification.
   */
  audioSources?: BriefSource[];
  writing?: boolean;
}) {
  const goal = eventCmGoalState(brief);
  const timeline = eventCmTimeline(brief);
  const seconds = (timeline.totalMs / 1000).toFixed(1);
  const chars = scriptChars(brief.script);
  const stale = scriptIsStale(brief);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[11px] text-ink-muted">
          {brief.presenter ? `${brief.presenter} ・ ` : ""}
          {brief.schedule.date
            ? `${brief.schedule.date} ${brief.schedule.weekday} ${brief.schedule.time}`
            : "日時未設定"}
        </p>
        <p className="text-[11px] text-ink-faint">
          16:9 / 1920×1080 / {seconds}秒 ・ {TIMING_LABEL[timeline.source]}
        </p>
      </div>

      {/* The goal. Dark surround because the film itself is ink-black. */}
      <div className="overflow-hidden rounded-2xl bg-[#0b0d13] p-2 shadow-sm">
        <EventCmPlayer brief={brief} />
      </div>

      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight">
            ナレーション
          </h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
          {chars > 0 ? (
            <span className="shrink-0 text-[11px] text-ink-faint">{chars}字</span>
          ) : null}
        </div>
        {stale ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
            資料や項目が変わったあと、ナレーションが書き直されていません。
            いまの映像は、変わる前の内容を読み上げています。
            上のパイプラインの「構造化」から書き直せます。
          </p>
        ) : null}
        {brief.script.scenes.length > 0 ? (
          <>
            {brief.script.angle ? (
              <p className="mt-3 text-pretty text-[12px] text-ink-muted">
                訴求軸: {brief.script.angle}
              </p>
            ) : null}
            <ol className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-white">
              {brief.script.scenes.map((scene) => (
                <li key={scene.role} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {scene.role}
                  </span>
                  <span className="text-pretty text-[13px] leading-relaxed">
                    {scene.text}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-hairline px-4 py-4 text-[12px] text-ink-muted">
            まだ台本がありません。いまの映像は各シーンの想定尺で並んでいます。
            台本を書くと尺がその文字数に合い、読み上げると実測に置き換わります。
          </p>
        )}
      </section>

      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight">
            BGM
          </h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
          <span className="shrink-0 text-[11px] text-ink-faint">
            {brief.voice ? "ナレーション中は音量が下がります" : "冒頭から最後まで一定"}
          </span>
        </div>
        {onEditFact ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {DEFAULT_ASSETS.filter((asset) => asset.kind === "bgm").map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onEditFact({ path: "bgm", src: asset.src })}
                disabled={writing}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  brief.bgm === asset.src
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline hover:border-ink",
                )}
              >
                {asset.label}
              </button>
            ))}
            {audioSources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => onEditFact({ path: "bgm", src: `material:${source.id}` })}
                disabled={writing}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  brief.bgm === `material:${source.id}`
                    ? "border-ink bg-ink text-paper"
                    : "border-hairline hover:border-ink",
                )}
              >
                {source.label}
              </button>
            ))}
            {brief.bgm ? (
              <button
                type="button"
                onClick={() => onEditFact({ path: "bgm", src: null })}
                disabled={writing}
                className="text-[11px] text-ink-faint hover:text-ink disabled:opacity-50"
              >
                音楽を外す
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-ink-faint">
          {audioSources.length > 0
            ? "入力ステージにアップロードした音声も選べます。BGMかどうかはこちらでは判定できないので、ここで選んだものがBGMとして使われます。"
            : "入力ステージに音声をアップロードすると、ここで選べるようになります。"}
        </p>
      </section>

      <section>
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
          />
        ) : null}
      </section>
    </div>
  );
}
