"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { deletionConsequence, type TreeNodeKind } from "@/lib/brand-tree-actions";
import { cn } from "@/lib/cn";

// The one confirm dialog for every kind of row.
//
// It has a second state that most delete dialogs do not: `delete_take` refuses
// outright when the take is the only holder of material somebody supplied — an
// upload, a fetched file, a paid generation — and asks what should happen to it.
// So the dialog opens as a plain confirmation and, if the server comes back with
// that question, turns into it rather than reporting a failure. The user is not
// asked in advance, because most takes have nothing at risk and a question about
// materials nobody supplied is noise.
//
// Deliberately not offered: a "delete everything inside" option. Emptying a
// container from a menu two clicks deep is how a tree gets destroyed by accident.

export type MaterialChoice = "promote" | "discard";

export interface AtRiskMaterial {
  id: string;
  label: string | null;
  kind: string | null;
}

export default function TreeDeleteDialog({
  open,
  kind,
  name,
  atRiskMaterials,
  materialChoice,
  deleting,
  error,
  onMaterialChoice,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  kind: TreeNodeKind;
  name: string;
  /** Non-null once the server has asked what happens to these. */
  atRiskMaterials: AtRiskMaterial[] | null;
  materialChoice: MaterialChoice | null;
  deleting: boolean;
  error: string | null;
  onMaterialChoice: (choice: MaterialChoice) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const asking = atRiskMaterials !== null;
  const blocked = asking && materialChoice === null;
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
              {asking ? "この素材はどうしますか？" : "削除しますか？"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
              {deletionConsequence(kind, name)}この操作は取り消せません。
            </AlertDialog.Description>

            {asking ? (
              <div className="mt-5 rounded-xl border border-hairline p-4">
                <p className="text-pretty text-xs text-ink-muted">
                  {atRiskMaterials.length > 0 ? (
                    <>
                      次の
                      <span className="mx-1 tabular-nums font-semibold text-ink">
                        {atRiskMaterials.length}
                      </span>
                      件は、この成果物だけが持っています。
                    </>
                  ) : (
                    "この成果物だけが持っている素材があります。"
                  )}
                </p>
                {atRiskMaterials.length > 0 ? (
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11px] text-ink-muted">
                    {atRiskMaterials.map((material) => (
                      <li key={material.id} className="truncate">
                        {material.label ?? material.kind ?? material.id}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onMaterialChoice("promote")}
                    aria-pressed={materialChoice === "promote"}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      materialChoice === "promote"
                        ? "border-ink bg-ink/[0.04]"
                        : "border-hairline hover:border-ink",
                    )}
                  >
                    <span className="block font-semibold text-ink">
                      素材はブランドに残す
                    </span>
                    <span className="mt-1 block text-pretty text-ink-muted">
                      他の動画やLPから再利用できます
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMaterialChoice("discard")}
                    aria-pressed={materialChoice === "discard"}
                    className={cn(
                      "rounded-xl border p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      materialChoice === "discard"
                        ? "border-red-600 bg-red-50"
                        : "border-hairline hover:border-red-600",
                    )}
                  >
                    <span className="block font-semibold text-red-700">
                      素材も一緒に削除する
                    </span>
                    <span className="mt-1 block text-pretty text-ink-muted">
                      ファイルも消えます。戻せません
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

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
                disabled={deleting || blocked}
                className="rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deleting
                  ? "削除しています…"
                  : blocked
                    ? "素材の扱いを選んでください"
                    : "削除する"}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
