"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useId } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  subjectLabel: string;
  url: string;
  savedUrl: string;
  saving: boolean;
  inspecting: boolean;
  error: string | null;
  onUrlChange: (url: string) => void;
  onSaveUrl: () => void;
  onInspect: () => void;
  onCancel: () => void;
};

export default function BrandSourceInputDialog({
  open,
  title,
  description,
  subjectLabel,
  url,
  savedUrl,
  saving,
  inspecting,
  error,
  onUrlChange,
  onSaveUrl,
  onInspect,
  onCancel,
}: Props) {
  const urlInputId = useId();
  const errorId = `${urlInputId}-error`;
  const working = saving || inspecting;
  const hasUrl = url.trim().length > 0;
  const urlChanged = url.trim() !== savedUrl.trim();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !working) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-black/45" />
        <Dialog.Viewport
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
          }}
        >
          <Dialog.Popup className="w-full max-w-xl rounded-2xl border border-hairline bg-white p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="text-balance font-display text-xl font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
              {description}
            </Dialog.Description>

            <section className="mt-6 rounded-2xl border border-hairline bg-ink/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">公式Webサイト</p>
                  <p className="mt-1 text-pretty text-xs text-ink-muted">
                    このURLを{subjectLabel}の情報源として使用します。
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-hairline bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
                  URL
                </span>
              </div>

              <label className="mt-4 block" htmlFor={urlInputId}>
                <span className="sr-only">公式WebサイトURL</span>
                <input
                  id={urlInputId}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="https://example.com"
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={Boolean(error)}
                  disabled={working}
                  className="w-full rounded-xl border border-hairline bg-white px-4 py-3 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:cursor-wait disabled:bg-ink/[0.03]"
                />
              </label>

              {error ? (
                <p
                  id={errorId}
                  className="mt-2 text-pretty text-xs text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onSaveUrl}
                  disabled={!hasUrl || !urlChanged || working}
                  className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-transparent"
                >
                  {saving ? "URLを保存しています…" : "URLだけ保存"}
                </button>
                <button
                  type="button"
                  onClick={onInspect}
                  disabled={!hasUrl || working}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
                >
                  {inspecting ? "最新情報を取得しています…" : "最新情報を取得"}
                </button>
              </div>
            </section>

            <p className="mt-4 text-pretty text-xs text-ink-muted">
              「URLだけ保存」では他の情報を変更しません。最新情報を取得した場合は、取得結果を確認してから上書きします。
            </p>

            <div className="mt-6 flex justify-end">
              <Dialog.Close
                disabled={working}
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:text-ink-faint"
              >
                閉じる
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
