// Delete R2 objects that will become unreachable in the V2 contract cleanup.
//
// Dry-run is the default. The database is read only; rows are removed by the
// matching SQL migration after this script succeeds.

import { createAdminSupabase } from "@/lib/supabase/server";
import { deleteR2Object, headR2Object } from "@/lib/r2";

const apply = process.argv.includes("--apply");
const PRESERVED_TITLE = "世界が恋する日本酒";

type KeyRow = { key: string; preserve: boolean; source: string };

async function main() {
  const supabase = createAdminSupabase();
  const { data: takes, error: takeError } = await supabase
    .from("takes")
    .select("id, take_renders(latest_artifact_id), take_inputs(material_id)")
    .eq("template_id", "event-promo")
    .eq("title", PRESERVED_TITLE);
  if (takeError) throw new Error(takeError.message);
  if (takes?.length !== 1) {
    throw new Error(`保全対象Takeが1件ではありません: ${takes?.length ?? 0}`);
  }

  const take = takes[0];
  const materialIds = new Set(
    (take.take_inputs ?? []).map((input) => input.material_id as string),
  );
  const latestArtifactIds = new Set(
    (take.take_renders ?? []).flatMap((render) =>
      render.latest_artifact_id ? [render.latest_artifact_id as string] : [],
    ),
  );
  if (materialIds.size !== 13 || latestArtifactIds.size !== 1) {
    throw new Error(
      `保全対象の閉包が想定外です: materials=${materialIds.size}, artifacts=${latestArtifactIds.size}`,
    );
  }

  const [materials, artifacts, candidates, mockups] = await Promise.all([
    supabase.from("brand_materials").select("id, r2_key").not("r2_key", "is", null),
    supabase.from("render_artifacts").select("id, r2_key"),
    supabase.from("logo_candidates").select("id, file_path").not("file_path", "is", null),
    supabase.from("logo_mockups").select("candidate_id, slot, image_path").not("image_path", "is", null),
  ]);
  for (const result of [materials, artifacts, candidates, mockups]) {
    if (result.error) throw new Error(result.error.message);
  }

  const keys: KeyRow[] = [
    ...(materials.data ?? []).map((row) => ({
      key: row.r2_key as string,
      preserve: materialIds.has(row.id as string),
      source: "material",
    })),
    ...(artifacts.data ?? []).map((row) => ({
      key: row.r2_key as string,
      preserve: latestArtifactIds.has(row.id as string),
      source: "artifact",
    })),
    ...(candidates.data ?? []).map((row) => ({
      key: row.file_path as string,
      preserve: false,
      source: "logo-candidate",
    })),
    ...(mockups.data ?? []).map((row) => ({
      key: row.image_path as string,
      preserve: false,
      source: "logo-mockup",
    })),
  ];
  const unique = new Map(keys.map((row) => [row.key, row]));
  const preserved = [...unique.values()].filter((row) => row.preserve);
  const doomed = [...unique.values()].filter((row) => !row.preserve);

  for (const row of preserved) {
    if (!(await headR2Object(row.key))) {
      throw new Error(`保全対象R2オブジェクトがありません: ${row.key}`);
    }
  }

  console.log(`R2 cleanup: preserve=${preserved.length}, delete=${doomed.length}`);
  if (!apply) {
    console.log("dry-run: --apply を付けると削除します");
    return;
  }

  const failures: string[] = [];
  for (const row of doomed) {
    try {
      await deleteR2Object(row.key);
    } catch (error) {
      failures.push(`${row.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures.length) {
    throw new Error(`R2削除失敗 (${failures.length}):\n${failures.join("\n")}`);
  }
  console.log(`R2 cleanup applied: deleted=${doomed.length}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
