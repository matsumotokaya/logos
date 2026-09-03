// Delete R2 objects that no database row points at any more.
//
//   npm run r2:prune            # dry-run: counts and a sample, nothing deleted
//   npm run r2:prune -- --apply # delete
//
// Deleting a row never deletes its object — delete_take queues keys instead,
// and a wipe (the v3 cutover) leaves the bytes behind entirely. So the only
// way to find what is unreachable is to walk the bucket and subtract every key
// the database still names.
//
// Reads the bucket, not a list of expectations: the previous version of this
// script derived doomed keys from the rows it wanted gone, which cannot see an
// object whose row has already been deleted.

import { createAdminSupabase } from "@/lib/supabase/server";
import { deleteR2Object, listR2Objects } from "@/lib/r2";

const apply = process.argv.includes("--apply");

/**
 * Everything under this prefix is off limits, whatever the database says.
 *
 * `defaults/` is addressed by code, not by rows: lib/assets/defaults.ts names
 * the BGM and stills, and `npm run sfx:sync` uploads the sound-effect pack
 * that only lib/event-cm/sfx-cues.ts knows about. A sweep that asks the
 * database alone counts all 64 of them as unreachable — and the SFX are not in
 * git (their licence forbids redistribution), so deleting them loses them.
 *
 * A prefix rather than the catalog's key list, because the two do not match:
 * the catalog names bgm/stills that were never uploaded, and R2 holds sfx the
 * catalog never mentions.
 */
const PROTECTED_PREFIXES = ["defaults/"];

const isProtected = (key: string): boolean =>
  PROTECTED_PREFIXES.some((prefix) => key.startsWith(prefix));

/** Every key the database still claims. A miss here deletes live data. */
async function referencedKeys(): Promise<Set<string>> {
  const supabase = createAdminSupabase();
  const [materials, artifacts, candidates, mockups, runs] = await Promise.all([
    supabase.from("brand_materials").select("r2_key").not("r2_key", "is", null),
    supabase.from("render_artifacts").select("r2_key").not("r2_key", "is", null),
    supabase.from("logo_candidates").select("file_path").not("file_path", "is", null),
    supabase.from("logo_mockups").select("image_path").not("image_path", "is", null),
    supabase.from("logo_asset_runs").select("output_path").not("output_path", "is", null),
  ]);
  for (const result of [materials, artifacts, candidates, mockups, runs]) {
    if (result.error) throw new Error(result.error.message);
  }

  const keys = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value !== "") keys.add(value);
  };
  for (const row of materials.data ?? []) add(row.r2_key);
  for (const row of artifacts.data ?? []) add(row.r2_key);
  for (const row of candidates.data ?? []) add(row.file_path);
  for (const row of mockups.data ?? []) add(row.image_path);
  for (const row of runs.data ?? []) add(row.output_path);
  return keys;
}

function mib(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

async function main() {
  const [objects, referenced] = await Promise.all([
    listR2Objects(),
    referencedKeys(),
  ]);
  const orphans = objects.filter(
    (object) => !referenced.has(object.key) && !isProtected(object.key),
  );
  const orphanBytes = orphans.reduce((sum, object) => sum + object.bytes, 0);

  console.log(
    `R2 ${objects.length}件 / DB参照 ${referenced.size}件 / 保護 ${objects.filter((o) => isProtected(o.key)).length}件 → 孤児 ${orphans.length}件 (${mib(orphanBytes)})`,
  );
  // A key the database names but the bucket does not hold is the opposite
  // problem, and a silent one: the row renders as a broken image.
  const missing = [...referenced].filter(
    (key) => !objects.some((object) => object.key === key),
  );
  if (missing.length > 0) {
    console.log(`\n⚠ DBが指しているのにR2に無いもの ${missing.length}件:`);
    for (const key of missing.slice(0, 10)) console.log(`  ${key}`);
  }
  if (orphans.length === 0) return;

  console.log("\n孤児の内訳（先頭ディレクトリ）:");
  const byPrefix = new Map<string, { count: number; bytes: number }>();
  for (const object of orphans) {
    const prefix = object.key.split("/")[0] ?? "(root)";
    const current = byPrefix.get(prefix) ?? { count: 0, bytes: 0 };
    byPrefix.set(prefix, {
      count: current.count + 1,
      bytes: current.bytes + object.bytes,
    });
  }
  for (const [prefix, stat] of [...byPrefix.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${prefix}/  ${stat.count}件  ${mib(stat.bytes)}`);
  }

  if (!apply) {
    console.log("\ndry-run: --apply を付けると削除します");
    return;
  }

  let deleted = 0;
  const failures: string[] = [];
  for (const object of orphans) {
    try {
      await deleteR2Object(object.key);
      deleted++;
    } catch (error) {
      failures.push(
        `${object.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(`\n削除 ${deleted}件 / 失敗 ${failures.length}件`);
  for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
