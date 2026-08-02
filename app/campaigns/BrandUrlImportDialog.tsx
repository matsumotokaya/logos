"use client";

import { Dialog } from "@base-ui/react/dialog";
import Image from "next/image";
import type { BrandUrlInspection } from "@/lib/brand-detail";

export type ImportFieldKey =
  | "name"
  | "organizationKind"
  | "industry"
  | "location"
  | "website"
  | "description";

const DEFAULT_FIELDS: ImportFieldKey[] = ["name", "website", "description"];

type Props = {
  open: boolean;
  nameLabel: string;
  inspection: BrandUrlInspection | null;
  fields?: ImportFieldKey[];
  current: Partial<Record<ImportFieldKey, string>>;
  selected: Partial<Record<ImportFieldKey, boolean>>;
  selectedBrandAssets?: boolean;
  applying?: boolean;
  description?: string;
  applyLabel?: string;
  error?: string | null;
  onSelectedChange: (field: ImportFieldKey, selected: boolean) => void;
  onSelectedBrandAssetsChange?: (selected: boolean) => void;
  onCancel: () => void;
  onApply: () => void;
};

export default function BrandUrlImportDialog({
  open,
  nameLabel,
  inspection,
  fields = DEFAULT_FIELDS,
  current,
  selected,
  selectedBrandAssets = false,
  applying = false,
  description = "チェックした項目だけ入力欄へ反映します。既存値は自動では上書きされません。",
  applyLabel = "選択した項目を反映",
  error = null,
  onSelectedChange,
  onSelectedBrandAssetsChange,
  onCancel,
  onApply,
}: Props) {
  const labels: Record<ImportFieldKey, string> = {
    name: nameLabel,
    organizationKind: "種別",
    industry: "業種",
    location: "所在地",
    website: "WebサイトURL",
    description: "説明",
  };
  const proposed: Record<ImportFieldKey, string> = {
    name: inspection?.name ?? "",
    organizationKind: inspection?.organizationKind ?? "",
    industry: inspection?.industry ?? "",
    location: inspection?.location ?? "",
    website: inspection?.finalUrl ?? "",
    description: inspection?.description ?? "",
  };
  const selectable = fields.filter(
    (field) => proposed[field] && proposed[field] !== (current[field] ?? ""),
  );
  const hasBrandAssets = Boolean(
    inspection?.brandAssets && onSelectedBrandAssetsChange,
  );
  const canApply =
    selectable.some((field) => selected[field]) ||
    (hasBrandAssets && selectedBrandAssets);
  const organizationKindLabels: Record<string, string> = {
    company: "会社",
    individual: "個人・個人事業",
    nonprofit: "非営利組織",
    other: "その他",
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !applying) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-black/45" />
        <Dialog.Viewport
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
          }}
        >
          <Dialog.Popup className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-xl focus:outline-none">
            <header className="shrink-0 border-b border-hairline px-5 py-4 sm:px-6 sm:py-5">
              <Dialog.Title className="text-balance font-display text-xl font-semibold text-ink">
                URLから取得した情報を確認
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-pretty text-sm text-ink-muted">
                {description}
              </Dialog.Description>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">

            <div className="space-y-3">
              {fields.map((field) => {
                const currentValue = current[field] ?? "";
                const changed = Boolean(
                  proposed[field] && proposed[field] !== currentValue,
                );
                const overwrites = Boolean(currentValue && changed);
                const display = (value: string) =>
                  field === "organizationKind"
                    ? organizationKindLabels[value] ?? value
                    : value;
                return (
                  <label
                    key={field}
                    className="grid cursor-pointer gap-3 rounded-xl border border-hairline p-4 sm:grid-cols-[1.25rem_8rem_minmax(0,1fr)] lg:grid-cols-[1.25rem_10rem_minmax(0,1fr)]"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selected[field])}
                      disabled={!changed || applying}
                      onChange={(event) => onSelectedChange(field, event.target.checked)}
                      className="mt-0.5 size-4 accent-black"
                    />
                    <span className="text-sm font-semibold text-ink">
                      {labels[field]}
                      {overwrites ? (
                        <span className="mt-1 block text-[10px] font-normal text-amber-700">
                          既存値を上書き
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 break-words text-xs">
                      <span className="block text-pretty break-words text-ink-faint">
                        現在: {display(currentValue) || "未入力"}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-pretty break-words text-ink">
                        取得: {display(proposed[field]) || "取得できませんでした"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {inspection?.brandAssets && onSelectedBrandAssetsChange ? (
              <label className="mt-3 grid cursor-pointer gap-3 rounded-xl border border-hairline p-4 sm:grid-cols-[1.25rem_8rem_minmax(0,1fr)] lg:grid-cols-[1.25rem_10rem_minmax(0,1fr)]">
                <input
                  type="checkbox"
                  checked={selectedBrandAssets}
                  disabled={applying}
                  onChange={(event) =>
                    onSelectedBrandAssetsChange?.(event.target.checked)
                  }
                  className="mt-0.5 size-4 accent-black"
                />
                <span className="text-sm font-semibold text-ink">
                  ブランドアセット
                  <span className="mt-1 block text-[10px] font-normal text-amber-700">
                    現在のブランドプロフィールへ反映
                  </span>
                </span>
                <span className="min-w-0 space-y-3 break-words text-xs">
                  {inspection.brandAssets.logo ? (
                    <span className="block rounded-lg bg-ink/[0.03] p-3">
                      <Image
                        src={`data:${inspection.brandAssets.logo.mediaType};base64,${inspection.brandAssets.logo.data}`}
                        alt="Webサイトから取得したロゴ候補"
                        width={240}
                        height={80}
                        unoptimized
                        className="h-14 w-auto max-w-full object-contain object-left"
                      />
                    </span>
                  ) : null}
                  {Object.keys(inspection.brandAssets.palette).length > 0 ? (
                    <span className="block">
                      <span className="block text-ink-faint">カラー</span>
                      <span className="mt-1 flex flex-wrap gap-2">
                        {Object.entries(inspection.brandAssets.palette).map(
                          ([role, color]) => (
                            <span
                              key={`${role}-${color}`}
                              className="flex items-center gap-1.5 text-[10px] text-ink-muted"
                            >
                              <span
                                aria-hidden
                                className="size-5 rounded-full border border-hairline"
                                style={{ backgroundColor: color }}
                              />
                              {color}
                            </span>
                          ),
                        )}
                      </span>
                    </span>
                  ) : null}
                  {inspection.brandAssets.designTokens?.body_font ||
                  inspection.brandAssets.designTokens?.heading_font ? (
                    <span className="block text-pretty text-ink-muted">
                      フォント: {[
                        inspection.brandAssets.designTokens.heading_font,
                        inspection.brandAssets.designTokens.body_font,
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  ) : null}
                </span>
              </label>
            ) : null}

            {selectable.length === 0 && !hasBrandAssets ? (
              <p className="mt-4 rounded-lg bg-ink/[0.03] px-4 py-3 text-pretty text-xs text-ink-muted">
                登録済みの情報から変更は見つかりませんでした。
              </p>
            ) : null}

            {inspection?.evidence.length ? (
              <details className="mt-4 rounded-lg bg-ink/[0.03] px-4 py-3">
                <summary className="cursor-pointer text-xs font-semibold text-ink">
                  取得根拠
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-pretty text-xs text-ink-muted">
                  {inspection.evidence.map((evidence) => (
                    <li key={evidence}>{evidence}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {error ? (
              <p className="mt-4 text-pretty text-xs text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Dialog.Close
                disabled={applying}
                className="rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:text-ink-faint"
              >
                キャンセル
              </Dialog.Close>
              <button
                type="button"
                onClick={onApply}
                disabled={applying || !canApply}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
              >
                {applying ? "上書きしています…" : applyLabel}
              </button>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
