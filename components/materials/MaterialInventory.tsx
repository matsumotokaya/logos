"use client";

// The material inventory: what this deliverable is made of, and what the brand
// already had.
//
// docs/asset-normalization.md §9. One implementation, two places — under the
// storyboard and inside the mapping drawer. Two implementations of one list is
// how a screen and a drawer end up disagreeing about what a video contains,
// which is exactly the bug videoState() was written to end.
//
// TWO TIERS, because the injection has two layers (§7). The base is what every
// deliverable of this brand starts from; the upper tier is what this one added.
// Showing them as one list would hide the thing the model is for — that a
// company's assets accumulate, and that a collaboration can decline them.
//
// GROUPED LIKE A DIRECTORY, because the naming scheme (§8) puts materials in
// `assets/<category>/` and the export unpacks that way. The screen, the ZIP and
// the export should read as one map rather than three arrangements of the same
// files.
//
// The row is read-only about PLACEMENT and editable about IDENTITY. Where a
// file is used is corrected in the storyboard panel that shows it; what a file
// IS is corrected here. Two editable copies of one value is how they diverge.

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_HINTS,
  MATERIAL_CATEGORY_LABELS,
  materialCategoryLabel,
  type MaterialCategory,
} from "@/lib/materials/category";
import { materialPath, uniqueMaterialPaths } from "@/lib/materials/naming";
import type {
  InventoryMaterial,
  InventoryPayload,
} from "@/app/api/brands/[id]/videos/[videoId]/inventory/route";

/** Where a file came from, in the second person rather than in schema words. */
const SOURCE_LABEL: Record<string, string> = {
  upload: "アップロード",
  url_fetch: "サイトから取得",
  ai_generated: "生成",
  derived: "ロゴ正本から",
  render_output: "書き出しから",
};

/** The medium, for the rows a category cannot describe (audio, fonts). */
const KIND_LABEL: Record<string, string> = {
  logo: "ロゴ",
  photo: "画像",
  keyvisual: "画像",
  illustration: "画像",
  audio: "音声",
  video: "動画",
  document: "資料",
  font: "フォント",
  other: "その他",
};

const readableSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Group into the folders an export would write.
 *
 * Names and folders come from lib/materials/naming.ts, the same function the
 * ZIP uses, so 「書き出したものと画面が同じ整理」 is true by construction rather
 * than by two implementations agreeing. Uniqueness is resolved per tier for the
 * same reason: what the screen shows is what unpacks.
 */
function groupByFolder(materials: InventoryMaterial[]) {
  const paths = uniqueMaterialPaths(materials);
  const folders = new Map<string, Array<{ material: InventoryMaterial; path: string }>>();
  for (const material of materials) {
    const path = paths.get(material.id) ?? materialPath(material);
    const folder = path.slice("assets/".length, path.lastIndexOf("/"));
    const bucket = folders.get(folder);
    const row = { material, path };
    if (bucket) bucket.push(row);
    else folders.set(folder, [row]);
  }
  return [...folders.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function CategoryPicker({
  material,
  disabled,
  onChange,
}: {
  material: InventoryMaterial;
  disabled: boolean;
  onChange: (category: MaterialCategory | null) => void;
}) {
  return (
    <label className="shrink-0">
      <span className="sr-only">{material.label} の分類</span>
      <select
        value={material.category ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : (event.target.value as MaterialCategory))
        }
        title={
          material.category
            ? MATERIAL_CATEGORY_HINTS[material.category as MaterialCategory]
            : "この素材が何かを選ぶと、次の実行でも同じ扱いになります"
        }
        className={cn(
          "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
          // Amber is this product's colour for "decided, not yet confirmed" —
          // the same meaning the unreflected-change badge carries. A guess is
          // not an error, so it is never red.
          material.category_source === "user"
            ? "border-hairline bg-white text-ink"
            : material.category
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-dashed border-hairline bg-white text-ink-faint",
          disabled && "opacity-50",
        )}
      >
        <option value="">未分類</option>
        {MATERIAL_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {MATERIAL_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
    </label>
  );
}

function MaterialRow({
  material,
  fileName,
  uses,
  overriddenBy,
  disabled,
  onClassify,
}: {
  material: InventoryMaterial;
  /** The normalised name — what the export writes and the download hands over. */
  fileName: string;
  uses: InventoryPayload["usage"][string] | undefined;
  /** Set when a material in the upper tier fills the same place as this one. */
  overriddenBy?: string;
  disabled: boolean;
  onClassify: (id: string, category: MaterialCategory | null) => void;
}) {
  const measured =
    material.width && material.height ? `${material.width}×${material.height}` : null;
  // Worth showing only when it differs: repeating 「miyao.jpg（元: miyao.jpg）」
  // on every row buries the cases where the name really did change.
  const renamed = fileName !== material.label;

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-hairline px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">
          {fileName}
        </span>
        <CategoryPicker
          material={material}
          disabled={disabled}
          onChange={(category) => onClassify(material.id, category)}
        />
      </div>
      {renamed ? (
        <p className="truncate text-[11px] text-ink-faint">元: {material.label}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-faint">
        <span>{KIND_LABEL[material.kind] ?? material.kind}</span>
        <span>{SOURCE_LABEL[material.source_kind] ?? material.source_kind}</span>
        {measured ? <span className="font-mono tabular-nums">{measured}</span> : null}
        {/* Only said when it is true and load-bearing: an opaque logo is the
            one that must never be knocked out (§3). Silence means "we have not
            measured it", which is a third state, not "transparent". */}
        {material.kind === "logo" && material.opaque === true ? <span>地あり</span> : null}
        {material.bytes ? (
          <span className="font-mono tabular-nums">{readableSize(material.bytes)}</span>
        ) : null}
      </div>
      {uses && uses.length > 0 ? (
        <p className="text-[11px] text-ink-muted">{uses.map((use) => use.label).join("、")}</p>
      ) : (
        // Not a defect. A deck is read, never shown; a photograph may simply
        // not have been placed yet. Saying so beats an empty column.
        <p className="text-[11px] text-ink-faint">この動画には出ていません</p>
      )}
      {overriddenBy ? (
        <p className="text-[11px] text-amber-800">
          この動画では「{overriddenBy}」を使っています（基盤を上書き中）
        </p>
      ) : null}
    </li>
  );
}

function Tier({
  title,
  note,
  materials,
  usage,
  overrides,
  disabled,
  onClassify,
  empty,
}: {
  title: string;
  note: string;
  materials: InventoryMaterial[];
  usage: InventoryPayload["usage"];
  overrides?: Map<string, string>;
  disabled: boolean;
  onClassify: (id: string, category: MaterialCategory | null) => void;
  empty: string;
}) {
  const folders = groupByFolder(materials);
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h4 className="text-[12px] font-medium text-ink">
          {title}
          <span className="ml-1.5 font-normal tabular-nums text-ink-faint">
            {materials.length}
          </span>
        </h4>
        <p className="text-[11px] text-ink-faint">{note}</p>
      </div>
      {folders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-hairline px-3 py-3 text-[11px] text-ink-faint">
          {empty}
        </p>
      ) : (
        folders.map(([folder, rows]) => (
          <div key={folder} className="flex flex-col gap-1">
            <p className="font-mono text-[11px] text-ink-faint">
              assets/{folder}/
              <span className="ml-1.5 font-sans">
                {folder === "unsorted" ? "未分類" : materialCategoryLabel(folder)}
              </span>
            </p>
            <ul className="flex flex-col gap-1 pl-3">
              {rows.map(({ material, path }) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  fileName={path.slice(path.lastIndexOf("/") + 1)}
                  uses={usage[material.id]}
                  overriddenBy={overrides?.get(material.id)}
                  disabled={disabled}
                  onClassify={onClassify}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

/**
 * Which base materials this deliverable has displaced.
 *
 * A base file is overridden when something in the upper tier occupies a place
 * it would have filled — the same role, not merely the same category. Only the
 * mark is decidable today, because that is the only base slot that exists
 * (§7.2 has yet to name the others), so the check is narrow on purpose: a
 * guess here would print a warning about a conflict that is not happening.
 */
function overrideMap(payload: InventoryPayload): Map<string, string> {
  const overrides = new Map<string, string>();
  const usedByOwn = payload.own.filter((material) => payload.usage[material.id]?.length);
  for (const base of payload.base) {
    if (base.kind !== "logo") continue;
    // The base mark is displaced only when it is not itself on screen and
    // another mark is.
    if (payload.usage[base.id]?.length) continue;
    const replacement = usedByOwn.find((material) => material.kind === "logo");
    if (replacement) overrides.set(base.id, replacement.label);
  }
  return overrides;
}

export default function MaterialInventory({
  payload,
  busy,
  onClassify,
}: {
  payload: InventoryPayload | null;
  busy?: boolean;
  /** Correct what a file is. Absent = read only. */
  onClassify?: (id: string, category: MaterialCategory | null) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  if (!payload) {
    return <p className="text-[12px] text-ink-faint">素材を読み込み中…</p>;
  }

  const classify = (id: string, category: MaterialCategory | null) => {
    if (!onClassify) return;
    setSaving(id);
    onClassify(id, category);
    // The parent refetches; clearing here keeps the row usable if it does not.
    setTimeout(() => setSaving((current) => (current === id ? null : current)), 1200);
  };

  const disabled = Boolean(busy) || !onClassify;
  const overrides = overrideMap(payload);

  return (
    <div className="flex flex-col gap-5">
      <Tier
        title="この動画の素材"
        note="この動画に固定されているもの。ここで分類を直すと、この素材を使う他の成果物にも反映されます。"
        materials={payload.own}
        usage={payload.usage}
        disabled={disabled || saving !== null}
        onClassify={classify}
        empty="まだ素材がありません。パイプラインの「入力」から資料や写真を入れてください。"
      />
      <Tier
        title="ブランドの基盤"
        note="このブランドが持っていて、新しい成果物に最初から入るもの。"
        materials={payload.base}
        usage={payload.usage}
        overrides={overrides}
        disabled={disabled || saving !== null}
        onClassify={classify}
        empty="このブランドにはまだ基盤の素材がありません。この動画の素材を「ブランドの基盤へ」上げると、次に作るものに最初から入ります。"
      />
    </div>
  );
}
