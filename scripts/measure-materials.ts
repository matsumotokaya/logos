// Backfill the measurements that intake now records (docs/asset-normalization.md §14-1).
//
// Everything registered before migration 0052 has opaque/luminance null, and
// most rows have width/height null as well — the columns existed since 0028 and
// nobody filled them. Measuring needs the bytes, so this fetches each object
// from R2 once and writes the four columns back.
//
// Dry-run is the default. `--apply` writes.
//
// Only rows that are actually unmeasured are touched, so re-running costs one
// listing and nothing else. A row that cannot be decoded stays null and is
// reported: "we could not measure this" is a fact worth seeing, and pretending
// it is opaque is exactly the guess that draws a mark as a white rectangle.

import { createAdminSupabase } from "@/lib/supabase/server";
import { getR2Object } from "@/lib/r2";
import { isMeasurable, measureMaterial } from "@/lib/materials/measure";

const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  label: string;
  kind: string;
  media_type: string | null;
  r2_key: string | null;
  width: number | null;
  opaque: boolean | null;
};

async function main() {
  const supabase = createAdminSupabase();

  const { data, error } = await supabase
    .from("brand_materials")
    .select("id, label, kind, media_type, r2_key, width, opaque")
    .not("r2_key", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  const measurable = rows.filter((row) => isMeasurable(row.media_type));
  const pending = measurable.filter((row) => row.opaque === null || row.width === null);

  console.log(
    `素材 ${rows.length} 件 / 測定できる形式 ${measurable.length} 件 / 未測定 ${pending.length} 件`,
  );
  if (pending.length === 0) {
    console.log("測定済みです。");
    return;
  }

  let measured = 0;
  let failed = 0;
  for (const row of pending) {
    const bytes = await getR2Object(row.r2_key as string);
    if (!bytes) {
      console.log(`  ✗ ${row.label} — R2に本体がありません`);
      failed += 1;
      continue;
    }
    const measurement = await measureMaterial(bytes, row.media_type);
    if (measurement.opaque === null && measurement.width === null) {
      console.log(`  ✗ ${row.label} — 読み取れませんでした (${row.media_type})`);
      failed += 1;
      continue;
    }

    const size = measurement.width ? `${measurement.width}×${measurement.height}` : "寸法不明";
    const plate = measurement.opaque ? "地あり" : "透過";
    console.log(
      `  ${apply ? "✓" : "·"} ${row.label} [${row.kind}] ${size} ${plate} 輝度=${measurement.luminance ?? "—"}`,
    );

    if (apply) {
      const updated = await supabase
        .from("brand_materials")
        .update({
          width: measurement.width,
          height: measurement.height,
          opaque: measurement.opaque,
          luminance: measurement.luminance,
        })
        .eq("id", row.id);
      if (updated.error) {
        console.log(`      → 更新できませんでした: ${updated.error.message}`);
        failed += 1;
        continue;
      }
    }
    measured += 1;
  }

  console.log(
    apply
      ? `\n${measured} 件を測定して保存しました。読めなかったもの: ${failed} 件`
      : `\n${measured} 件が測定できます（--apply で保存）。読めなかったもの: ${failed} 件`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
