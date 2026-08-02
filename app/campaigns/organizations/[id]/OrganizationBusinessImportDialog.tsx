"use client";

import { Dialog } from "@base-ui/react/dialog";

type Props = {
  open: boolean;
  businessName: string;
  currentOrganizationName: string;
  targetOrganizationName: string;
  importing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function OrganizationBusinessImportDialog({
  open,
  businessName,
  currentOrganizationName,
  targetOrganizationName,
  importing,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !importing) onCancel();
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
          <Dialog.Popup
            aria-busy={importing}
            className="w-full max-w-lg rounded-2xl border border-hairline bg-white p-6 shadow-xl focus:outline-none"
          >
            <Dialog.Title className="text-balance font-display text-xl font-semibold text-ink">
              事業ブランドを取り込む
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
              「{businessName}」の親Organizationを変更します。
            </Dialog.Description>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-ink/[0.03] p-4 text-sm">
              <span className="min-w-0 truncate text-ink-muted">
                {currentOrganizationName}
              </span>
              <span aria-hidden="true">→</span>
              <span className="min-w-0 truncate font-semibold">
                {targetOrganizationName}
              </span>
            </div>

            <p className="mt-4 text-pretty text-xs text-ink-muted">
              ブランドに紐づくロゴ、LP、動画、対象別ブランドは保持されます。親から継承しているブランドルールは取り込み先の内容に切り替わります。
            </p>

            {error ? (
              <p className="mt-4 text-pretty text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close
                disabled={importing}
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:text-ink-faint"
              >
                キャンセル
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                disabled={importing}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:bg-ink/25"
              >
                {importing ? "取り込んでいます…" : "このOrganizationに取り込む"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
