"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { UrlRegistrationScope } from "@/lib/brand-registration";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{
  value: UrlRegistrationScope;
  label: string;
  description: string;
}> = [
  {
    value: "business",
    label: "サービス・製品",
    description: "このサービス・製品の情報とブランドとして登録します。",
  },
  {
    value: "organization",
    label: "企業・組織",
    description: "企業情報とコーポレートブランドを登録し、生成物は推定した主事業に保存します。",
  },
  {
    value: "both",
    label: "企業・組織かつサービス・製品",
    description: "企業と主事業を作り、同じブランド情報を継承します。",
  },
];

type Props = {
  open: boolean;
  url: string;
  value: UrlRegistrationScope;
  onValueChange: (value: UrlRegistrationScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function UrlRegistrationDialog({
  open,
  url,
  value,
  onValueChange,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
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
          <Dialog.Popup className="w-full max-w-lg rounded-2xl border border-hairline bg-white p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="text-balance font-display text-xl font-semibold text-ink">
              URLからマーケティングアセットを生成する
            </Dialog.Title>

            <p className="mt-4 truncate rounded-lg bg-ink/[0.04] px-3 py-2 text-xs text-ink-muted">
              {url}
            </p>

            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">URLのページ種別</legend>
              {OPTIONS.map((option) => {
                const selected = value === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-4",
                      "hover:border-ink/40",
                      selected
                        ? "border-ink bg-ink/[0.04]"
                        : "border-hairline bg-white",
                    )}
                  >
                    <input
                      type="radio"
                      name="url-registration-scope"
                      value={option.value}
                      checked={selected}
                      onChange={() => onValueChange(option.value)}
                      className="mt-0.5 size-4 accent-black"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-pretty text-xs leading-relaxed text-ink-muted">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                戻る
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                生成する
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
