"use client";

// The music control, built the same way as the narration one.
//
// Same shape on purpose: BGM and narration are the two things the film SAYS out
// loud, they are both always-on-or-off, and both are chosen once and changed on
// a whim. Two controls that answer the same kind of question should not be one
// row of pills under the storyboard and one button in the header.
//
// The difference is that nothing is generated here. A track is chosen, the brief
// records it, and the player is already playing it on the next load — so the
// confirmation says 変更しました rather than 完成しました.

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { DefaultAsset } from "@/lib/assets/defaults";
import type { BriefSource } from "./BriefSourceIntake";

export default function BgmDialog({
  /** The brief's own pointer: a pool path, or `material:<uuid>`. */
  current,
  pool,
  uploads,
  /** Whether a narration exists — it decides how the music behaves, not
   *  whether it plays. */
  ducks,
  busy,
  onChoose,
  onTurnOff,
}: {
  current: string | null;
  pool: readonly DefaultAsset[];
  uploads: readonly BriefSource[];
  ducks: boolean;
  busy: boolean;
  onChoose: (src: string) => Promise<boolean>;
  onTurnOff: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(current);
  const [done, setDone] = useState<string | null>(null);

  const options = [
    ...pool.map((asset) => ({
      src: asset.src,
      label: asset.label,
      note: asset.credit,
      warn: asset.licensed ? null : "書き出しには乗りません（仮素材）",
    })),
    ...uploads.map((source) => ({
      src: `material:${source.id}`,
      label: source.label,
      note: "この動画にアップロードした音声",
      warn: null,
    })),
  ];
  const currentLabel = options.find((option) => option.src === current)?.label ?? null;

  const run = async (work: () => Promise<boolean>, message: string) => {
    const ok = await work();
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
        if (next) setChosen(current);
        else setDone(null);
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
          BGM
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-1.5 rounded-full",
              current ? "bg-emerald-500" : "bg-ink/25",
            )}
          />
          <span className="sr-only">{current ? "現在オン" : "現在オフ"}</span>
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
          <Dialog.Popup className="mx-auto mt-16 w-full max-w-lg rounded-2xl bg-paper p-5 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="font-display text-base font-semibold">
                  BGM
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-ink-muted">
                  {current
                    ? `オン ・ ${currentLabel ?? "この動画の音源"} ・ ${
                        ducks ? "読み上げ中は音量が下がります" : "冒頭から最後まで一定"
                      }`
                    : "オフ（無音の映像になります）"}
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
                流す曲
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {options.map((option) => (
                  <label
                    key={option.src}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition",
                      chosen === option.src
                        ? "border-ink bg-ink/[0.03]"
                        : "border-hairline hover:border-ink/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="bgm-track"
                      value={option.src}
                      checked={chosen === option.src}
                      onChange={() => setChosen(option.src)}
                      className="size-4 accent-ink"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{option.label}</span>
                      <span className="block text-[11px] text-ink-faint">{option.note}</span>
                    </span>
                    {option.warn ? (
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {option.warn}
                      </span>
                    ) : null}
                    {current === option.src ? (
                      <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                        使用中
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                {uploads.length > 0
                  ? "入力ステージにアップロードした音声も選べます。BGMかどうかはこちらでは判定できないので、ここで選んだものが流れます。"
                  : "入力ステージに音声をアップロードすると、ここに並びます。"}
              </p>
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
              <div className="flex flex-wrap items-center gap-2">
                {current ? (
                  <button
                    type="button"
                    onClick={() => void run(onTurnOff, "BGMをオフにしました")}
                    disabled={busy || Boolean(done)}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold transition hover:border-ink disabled:opacity-50"
                  >
                    BGMをオフにする
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    chosen
                      ? void run(() => onChoose(chosen), "BGMを変更しました")
                      : undefined
                  }
                  disabled={busy || !chosen || chosen === current || Boolean(done)}
                  title={chosen === current ? "この曲が使われています" : undefined}
                  className="ml-auto rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
                >
                  {busy ? "保存中…" : "この曲にする"}
                </button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
