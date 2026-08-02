"use client";

import { Dialog } from "@base-ui/react/dialog";

type Props = {
  open: boolean;
  businessName: string;
  currentOrganizationName: string;
  targetOrganizationName: string;
  logoCount: number;
  campaignCount: number;
  audienceCount: number;
  moving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function BusinessMoveDialog({
  open,
  businessName,
  currentOrganizationName,
  targetOrganizationName,
  logoCount,
  campaignCount,
  audienceCount,
  moving,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !moving) onCancel();
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
              ブランドを取り込む
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
              「{businessName}」の所属先を変更します。
            </Dialog.Description>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-ink/[0.03] p-4 text-sm">
              <span className="min-w-0 truncate text-ink-muted">{currentOrganizationName}</span>
              <span aria-hidden="true">→</span>
              <span className="min-w-0 truncate font-semibold">{targetOrganizationName}</span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg border border-hairline px-2 py-3">
                <dt className="text-ink-muted">ロゴ</dt>
                <dd className="mt-1 tabular-nums font-semibold">{logoCount}</dd>
              </div>
              <div className="rounded-lg border border-hairline px-2 py-3">
                <dt className="text-ink-muted">LP</dt>
                <dd className="mt-1 tabular-nums font-semibold">{campaignCount}</dd>
              </div>
              <div className="rounded-lg border border-hairline px-2 py-3">
                <dt className="text-ink-muted">対象別ブランド</dt>
                <dd className="mt-1 tabular-nums font-semibold">{audienceCount}</dd>
              </div>
            </dl>

            <p className="mt-4 text-pretty text-xs text-ink-muted">
              これらのデータは保持されます。親から継承するカラーやブランドルールは、取り込み先の内容に切り替わります。
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close
                disabled={moving}
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                キャンセル
              </Dialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                disabled={moving}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
              >
                {moving ? "取り込んでいます…" : "このOrganizationに取り込む"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
