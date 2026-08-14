"use client";

// "The event is called X. Rename this video to that?"
//
// Asked rather than done. Reading a flyer changes the film's title, and syncing
// the video's own name to it is almost always right — but some people name their
// work, and a tool that renames a thing because it read a PDF has taken a
// decision that was not its to take. So the film updates itself and the name
// waits for a person.
//
// Sits next to the title it is about. A prompt somewhere else would be asking
// about something the reader cannot see.

export default function TitleOffer({
  proposed,
  busy,
  onAccept,
  onDecline,
}: {
  proposed: string;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent/30 bg-accent/[0.04] px-4 py-2.5">
      <p className="min-w-0 text-pretty text-[12px] text-ink">
        資料から読み取ったイベント名は
        <span className="mx-1 font-semibold">「{proposed}」</span>
        です。この動画の名前も変えますか？
      </p>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="text-[11px] text-ink-faint hover:text-ink disabled:opacity-50"
        >
          このままにする
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
        >
          タイトルを変える
        </button>
      </span>
    </div>
  );
}
