"use client";

// The reading-aloud control: one button, always the same button.
//
// Reading a scenario aloud is not a step that completes. The words change, the
// delivery can be wrong, a different voice may suit the event better — so the
// control does not advertise a state ("読み上げる" → "読み上げ直す") and does not
// go away once a recording exists. It says 読み上げ, it opens, and inside you can
// record over whatever is there as many times as you like.
//
// It is called 読み上げ and not ナレーション because the words themselves are the
// SCENARIO (§9.1). One word for the story and its recording is what let three
// surfaces argue about which one the film was made from.
//
// Off is a first-class choice, not a failure to record: an event film with
// music and subtitles and no voice is a finished thing. Turning it off keeps
// the recording (the API only clears the brief's pointer), so it can come back.

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { cn } from "@/lib/cn";
import StatusDot from "./StatusDot";
import { NARRATION_VOICES } from "@/lib/narration/voices";

export default function NarrationDialog({
  hasVoice,
  currentVoiceId,
  totalMs,
  mock,
  canSpeak,
  unreflected,
  busy,
  onSpeak,
  onTurnOff,
}: {
  hasVoice: boolean;
  /** Preset the existing recording used, when it maps to one. */
  currentVoiceId: string | null;
  totalMs: number | null;
  mock: boolean;
  /** False while there is no scenario to read. */
  canSpeak: boolean;
  /** The recording is not the one the played film has (§5). */
  unreflected: boolean;
  busy: boolean;
  /** Resolves true when the take actually changed. */
  onSpeak: (voiceId: string) => Promise<boolean>;
  onTurnOff: () => Promise<boolean>;
}) {
  const [chosen, setChosen] = useState<string>(currentVoiceId ?? NARRATION_VOICES[0].id);
  const [open, setOpen] = useState(false);
  // What just happened, said in the dialog that asked for it.
  //
  // Without this the dialog sat there unchanged while the work happened
  // somewhere behind it, and a finished recording was indistinguishable from a
  // click that never registered. The message is shown for a moment and then the
  // dialog closes itself: the reason to be here is gone once it worked.
  const [done, setDone] = useState<string | null>(null);

  const run = async (work: () => Promise<boolean>, message: string) => {
    const ok = await work();
    // A failure keeps the dialog open — the page's error banner is behind it,
    // and closing would hide both the message and the controls to try again.
    if (!ok) return;
    setDone(message);
    setTimeout(() => {
      setOpen(false);
      setDone(null);
    }, 900);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDone(null);
      }}
    >
      <Dialog.Trigger
        render={
          <button
            type="button"
            className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        }
      >
        <span className="inline-flex items-center gap-2">
          読み上げ
          {/* Whether the film speaks, AND whether the film being played is the
              one that says it. The label never changes, because the action
              available is the same either way (components/video/StatusDot.tsx). */}
          <StatusDot on={hasVoice} unreflected={unreflected} />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
          <Dialog.Popup className="mx-auto mt-16 w-full max-w-lg rounded-2xl bg-paper p-5 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-base font-semibold">
                  読み上げ
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-ink-muted">
                  {hasVoice
                    ? `オン${totalMs ? ` ・ ${(totalMs / 1000).toFixed(1)}秒` : ""}${
                        mock ? " ・ 開発用の音声" : ""
                      }`
                    : "オフ（音楽と字幕だけで成立します）"}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="閉じる"
                className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline text-[14px] leading-none text-ink-muted transition hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span aria-hidden="true">×</span>
              </Dialog.Close>
            </div>

            <fieldset className="mt-4">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                読み上げる声
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {NARRATION_VOICES.map((voice) => (
                  <label
                    key={voice.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition",
                      chosen === voice.id
                        ? "border-ink bg-ink/[0.03]"
                        : "border-hairline hover:border-ink/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="narration-voice"
                      value={voice.id}
                      checked={chosen === voice.id}
                      onChange={() => setChosen(voice.id)}
                      className="size-4 accent-ink"
                    />
                    <span className="min-w-14 font-medium">{voice.label}</span>
                    <span className="min-w-0 flex-1 text-ink-muted">{voice.note}</span>
                    {/* The Gemini name and its documented character ride along:
                        the gender labels are ours, so the row has to carry
                        enough for a listener to tell us one is wrong. */}
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                      {voice.voice} / {voice.character}
                    </span>
                    {currentVoiceId === voice.id && hasVoice ? (
                      <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                        使用中
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 border-t border-hairline pt-4">
              {done ? (
                <p
                  role="status"
                  className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800"
                >
                  {done}
                </p>
              ) : null}
              {/* Off on the left, record on the right: the affirmative action
                  sits where the eye finishes. */}
              <div className="flex flex-wrap items-center gap-2">
                {hasVoice ? (
                  <button
                    type="button"
                    onClick={() => void run(onTurnOff, "読み上げをオフにしました")}
                    disabled={busy || Boolean(done)}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
                  >
                    読み上げをオフにする
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    void run(
                      () => onSpeak(chosen),
                      hasVoice ? "読み上げを作り直しました" : "読み上げが完成しました",
                    )
                  }
                  disabled={busy || !canSpeak || Boolean(done)}
                  title={canSpeak ? undefined : "先にシナリオを書いてください"}
                  className="ml-auto rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
                >
                  {busy ? "作成中…" : hasVoice ? "この声で作り直す" : "この声で読み上げる"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-ink-faint">
                作り直すと今の音声を置き換えます。オフにしても録音は残るので、いつでも戻せます。
              </p>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
