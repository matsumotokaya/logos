"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

type Props = {
  open: boolean;
  organizationName: string;
  brandCount: number;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function OrganizationDeleteDialog({
  open,
  organizationName,
  brandCount,
  deleting,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !deleting) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-black/45" />
        <AlertDialog.Viewport
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
          }}
        >
          <AlertDialog.Popup
            aria-busy={deleting}
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xl focus:outline-none"
          >
            <AlertDialog.Title className="text-balance font-display text-xl font-semibold text-ink">
              このOrganizationを削除しますか？
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
              「{organizationName}
              」を削除します。この操作は取り消せません。Organization自体のメタ情報だけが対象で、配下のブランドやロゴはOrganizationの移管・削除まで残ります。
            </AlertDialog.Description>

            <div className="mt-5 rounded-xl bg-red-50 p-4 text-pretty text-xs text-red-800">
              このOrganizationに紐づくブランド
              <span className="mx-1 tabular-nums font-semibold">
                {brandCount}
              </span>
              件があるため、先に別のOrganizationへ移動してください。
            </div>

            {error ? (
              <p className="mt-4 text-pretty text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Close
                disabled={deleting}
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:text-ink-faint"
              >
                キャンセル
              </AlertDialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:bg-red-300"
              >
                {deleting ? "削除しています…" : "Organizationを削除する"}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
