"use client";

// Taking the video away.
//
// The premise of this button is that what someone made here is theirs, and that
// a tool people can leave is a tool worth staying in. Most videos will be
// finished in the app; some will need a pass that no template covers, and that
// case should end with a project folder rather than with a support request.
//
// The dialog exists for one honest reason: the zip cannot contain everything.
// Remotion is not ours to pass on, and neither is any default asset we only
// licensed for our own productions. Saying so before the download — and naming
// what is missing rather than warning in general — is the difference between a
// consent screen and a disclaimer nobody reads.
//
// When nothing is excluded it says that too. A modal that warns about a risk
// that does not apply teaches people to click through modals.

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import type { DefaultAsset } from "@/lib/assets/defaults";

export default function ProjectExportDialog({
  /** Default assets in this video that cannot be redistributed. */
  unlicensed,
  /** False while the film has never been run: there is nothing fixed to export. */
  ready,
  onDownload,
}: {
  unlicensed: DefaultAsset[];
  ready: boolean;
  onDownload: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    const ok = await onDownload();
    setBusy(false);
    if (ok) setOpen(false);
    else setError("プロジェクトを書き出せませんでした。時間をおいて、もう一度お試しください");
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
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
        プロジェクトデータを出力
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6">
          <Dialog.Popup className="mx-auto mt-16 w-full max-w-lg rounded-2xl bg-paper p-5 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="font-display text-base font-semibold">
                  プロジェクトデータを出力
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12px] text-ink-muted">
                  この動画を Remotion のプロジェクトとして書き出します。テンプレートのソースと、この動画に固定された素材が入っているので、続きは手元で作れます。
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="閉じる"
                className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline text-[14px] leading-none text-ink-muted transition hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                ×
              </Dialog.Close>
            </div>

            <div className="mt-4 rounded-xl border border-hairline p-4">
              <p className="text-[12px] font-semibold">同梱しないもの</p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-ink-muted">
                <li>
                  <span className="font-medium text-ink">Remotion 本体</span> —
                  再配布できないため、<code className="rounded bg-ink/[0.06] px-1">package.json</code>{" "}
                  の依存として書いてあります。
                  <code className="rounded bg-ink/[0.06] px-1">npm install</code>{" "}
                  すると、あなたのライセンスで入ります
                </li>
                {unlicensed.length > 0 ? (
                  <li>
                    <span className="font-medium text-ink">
                      再配布できない既定素材（{unlicensed.length}件）
                    </span>{" "}
                    — {unlicensed.map((asset) => asset.label).join("、")}
                    。ブリーフからも参照を外すので、そのままでも動きます（その音が鳴らないだけです）
                  </li>
                ) : (
                  <li>
                    この動画が使っている既定素材は<span className="font-medium text-ink">すべて同梱できます</span>
                    。商用利用可のものだけを使っているためです
                  </li>
                )}
              </ul>
              <p className="mt-3 text-[12px] text-ink-muted">
                写真・ロゴ・音声などの素材の権利は、それを用意した人のものです。このZIPは制作の続きをするためのもので、素材を再配布する権利は含みません。
              </p>
            </div>

            {!ready ? (
              <p className="mt-3 text-[12px] text-amber-700">
                この動画はまだ一度も実行されていません。いまの下書きのまま書き出します。
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-[12px] font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-3">
              <Dialog.Close className="text-[11px] font-semibold text-ink-muted transition hover:text-ink">
                やめる
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void download()}
                disabled={busy}
                className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-semibold text-paper transition hover:bg-accent disabled:opacity-50"
              >
                {busy ? "書き出し中…" : "同意してダウンロード"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
