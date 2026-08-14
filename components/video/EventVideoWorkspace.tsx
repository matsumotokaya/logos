"use client";

// The event promo workspace: the goal (the finished video) always on screen,
// with the material slots underneath it.
//
// Shared by the brand's video detail screen (the real home) and the labs
// preview, so the two can never drift into showing different things. The
// drawers that will hold the input → extraction → structuring stages attach to
// this shell later; today the slot list is read-only.

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import { briefSlots, type SlotState } from "@/remotion/event/slots";
import { EVENT_DURATION_FRAMES, EVENT_FPS } from "@/remotion/event/palette";
import type { EventBrief } from "@/remotion/event/types";

// The Remotion Player needs the DOM and is a heavy dependency, so it is only
// loaded in the browser. The dynamic import lives in this client component
// because `ssr: false` is not allowed with next/dynamic in a Server Component.
const EventVideoPlayer = dynamic(() => import("./EventVideoPlayerClient"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center text-[12px] text-white/50">
      プレビューを読み込み中…
    </div>
  ),
});

const STATE_STYLE: Record<SlotState, { label: string; className: string }> = {
  asset: { label: "素材", className: "border-accent/40 bg-accent/5 text-accent" },
  // Not an error state: the composition ships a designed substitute, which is
  // the whole point of the template. Styled as neutral information.
  fallback: { label: "フォールバック", className: "border-hairline bg-ink/[0.03] text-ink-muted" },
  omitted: { label: "省略中", className: "border-hairline bg-ink/[0.03] text-ink-muted" },
};

export default function EventVideoWorkspace({ brief }: { brief: EventBrief }) {
  const groups = briefSlots(brief);
  const seconds = Math.round(EVENT_DURATION_FRAMES / EVENT_FPS);

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
          16:9 / 1920×1080 / {seconds}秒 / 読み上げなし
        </p>
      </div>

      {/* The goal. Dark surround because the video itself is ink-black — a
          white frame around it would fight the art direction. */}
      <div className="overflow-hidden rounded-2xl bg-[#0b0d13] p-2 shadow-sm">
        <EventVideoPlayer brief={brief} />
      </div>

      <section>
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-base font-semibold tracking-tight">素材スロット</h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        </div>
        <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-muted">
          各スロットが「素材で描かれているか、設計済みフォールバックで成立しているか」の一覧。
          フォールバックは欠陥ではなく、素材ゼロでも完成した動画を出すための設計です。
          確定情報だけは別で、未確定なら捏造せず画面から省きます。
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.label} className="rounded-xl border border-hairline bg-white p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                {group.label}
              </h3>
              {group.slots.length === 0 ? (
                <p className="mt-3 text-[11px] text-ink-muted">まだありません。</p>
              ) : (
                <ul className="mt-3 divide-y divide-hairline">
                  {group.slots.map((slot) => {
                    const style = STATE_STYLE[slot.state];
                    return (
                      <li key={slot.id} className="flex items-start gap-3 py-2.5">
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            style.className,
                          )}
                        >
                          {style.label}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{slot.label}</span>
                          <span className="block break-words text-[11px] text-ink-muted">
                            {slot.detail}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
