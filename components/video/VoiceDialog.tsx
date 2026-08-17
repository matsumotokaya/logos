"use client";

// The voice control: one button, always the same button.
//
// Reading a narration aloud is not a step that completes. The words change, the
// delivery can be wrong, a different voice may suit the event better — so the
// control does not advertise a state ("読み上げる" → "読み上げ直す") and does not
// go away once a recording exists. It says ボイス, it opens, and inside you can
// record over whatever is there as many times as you like.
//
// It is called ボイス and not ナレーション because the words themselves are the
// NARRATION: the narration is what the film says, and the voice is one of the
// two ways it says it (the other is the subtitles). One word for both is what
// let three surfaces argue about which one the film was made from.
//
// Off is a first-class choice, not a failure to record: an event film with
// music and subtitles and no voice is a finished thing. Turning it off keeps
// the recording (the API only clears the brief's pointer), so it can come back.
//
// CHOOSING IS NOT RECORDING. Picking a voice saves a setting and returns at
// once; the reading happens when 「動画を作り直す」 runs, with everything else
// that is waiting. It used to start text-to-speech on the spot — a minute of
// waiting, a dialog that closed itself, and a player that had not changed,
// because a recording is not a film until the film is fixed. The gap between
// what that button seemed to promise and what it did was the whole problem.

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { cn } from "@/lib/cn";
import StatusDot from "./StatusDot";
import { VOICE_PRESETS } from "@/lib/voice/voices";

export default function VoiceDialog({
  hasVoice,
  currentVoiceId,
  narrator,
  totalMs,
  mock,
  unreflected,
  busy,
  onChoose,
  onTurnOff,
}: {
  hasVoice: boolean;
  /** Preset the existing recording actually used, when it maps to one. */
  currentVoiceId: string | null;
  /** Preset the take is SET to. What the next reading will use. */
  narrator: string | null;
  totalMs: number | null;
  mock: boolean;
  /** The recording is not the one the played film has (§5). */
  unreflected: boolean;
  busy: boolean;
  /** Save the choice. Records nothing aloud. Resolves true when it saved. */
  onChoose: (voiceId: string) => Promise<boolean>;
  onTurnOff: () => Promise<boolean>;
}) {
  const set = narrator ?? currentVoiceId ?? VOICE_PRESETS[0].id;
  const [chosen, setChosen] = useState<string>(set);
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
          ボイス
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
                  ボイス
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
                {VOICE_PRESETS.map((voice) => (
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
                    {/* Two different facts, and telling them apart is the point
                        of splitting the choice from the recording: what the
                        film currently speaks, and what the next reading will
                        use. They are the same until somebody picks another. */}
                    {currentVoiceId === voice.id && hasVoice ? (
                      <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                        再生中の声
                      </span>
                    ) : set === voice.id ? (
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        次に使う
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
                    onClick={() => void run(onTurnOff, "ボイスをオフにしました")}
                    disabled={busy || Boolean(done)}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
                  >
                    ボイスをオフにする
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void run(() => onChoose(chosen), "この声にしました")}
                  disabled={busy || chosen === set || Boolean(done)}
                  title={chosen === set ? "この声が選ばれています" : undefined}
                  className="ml-auto rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
                >
                  {busy ? "保存中…" : "この声にする"}
                </button>
              </div>
              {/* Says what will happen and when, because the button no longer
                  does the slow thing itself. */}
              <p className="mt-3 text-[11px] text-ink-faint">
                選んだ声で読み上げるのは「動画を作り直す」を押したときです。オフにしても録音は残るので、いつでも戻せます。
              </p>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
