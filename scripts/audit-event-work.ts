// Reproducible integrity audit for the v2 event-promo / LP material-sharing PoC.
//
// It performs only reads: database rows through the service client and R2 HEAD
// requests. Use it after changing either renderer, material migration, or the
// work/take model.
//
//   npm run takes:audit-event-work -- --video-take <UUID> --lp-take <UUID>

import { createAdminSupabase } from "@/lib/supabase/server";
import { headR2Object } from "@/lib/r2";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};

type Take = {
  id: string;
  work_id: string | null;
  template_id: string;
};
type Input = { take_id: string; material_id: string };
type Material = { id: string; r2_key: string | null; bytes: number | null };
type Render = { id: string; take_id: string; status: string; latest_artifact_id: string | null };
type Artifact = { id: string; r2_key: string; bytes: number | null; checksum: string | null };

async function main() {
  const videoTakeId = flag("video-take");
  const lpTakeId = flag("lp-take");
  if (!videoTakeId || !lpTakeId) {
    throw new Error("--video-take <UUID> と --lp-take <UUID> が必要です");
  }

  const supabase = createAdminSupabase();
  const [takesResult, inputsResult] = await Promise.all([
    supabase.from("takes").select("id, work_id, template_id").in("id", [videoTakeId, lpTakeId]),
    supabase.from("take_inputs").select("take_id, material_id").in("take_id", [videoTakeId, lpTakeId]),
  ]);
  if (takesResult.error) throw new Error(`Takeを読めませんでした: ${takesResult.error.message}`);
  if (inputsResult.error) throw new Error(`入力素材を読めませんでした: ${inputsResult.error.message}`);

  const takes = new Map(((takesResult.data ?? []) as Take[]).map((take) => [take.id, take]));
  const video = takes.get(videoTakeId);
  const lp = takes.get(lpTakeId);
  assert(video?.template_id === "event-promo", "動画Takeがevent-promoではありません");
  assert(lp?.template_id === "campaign-lp", "LP Takeがcampaign-lpではありません");
  assert(video.work_id && video.work_id === lp.work_id, "2つのTakeが同じWorkに属していません");

  const inputs = (inputsResult.data ?? []) as Input[];
  const videoMaterialIds = new Set(
    inputs.filter((input) => input.take_id === videoTakeId).map((input) => input.material_id),
  );
  const lpMaterialIds = new Set(
    inputs.filter((input) => input.take_id === lpTakeId).map((input) => input.material_id),
  );
  assert(videoMaterialIds.size > 0, "動画Takeに入力素材がありません");
  assert(sameSet(videoMaterialIds, lpMaterialIds), "LPと動画の入力素材セットが一致しません");

  const { data: materialRows, error: materialError } = await supabase
    .from("brand_materials")
    .select("id, r2_key, bytes")
    .in("id", [...videoMaterialIds]);
  if (materialError) throw new Error(`素材を読めませんでした: ${materialError.message}`);
  const materials = materialRows as Material[];
  assert(materials.length === videoMaterialIds.size, "固定済み素材の行が欠けています");

  const materialStats = await Promise.all(
    materials.map(async (material) => {
      assert(material.r2_key, `R2キーが無い素材です: ${material.id}`);
      const stat = await headR2Object(material.r2_key);
      assert(stat, `R2に存在しない素材です: ${material.id}`);
      assert(
        material.bytes === null || stat.size === material.bytes,
        `素材サイズがDBと一致しません: ${material.id}`,
      );
      return stat;
    }),
  );

  const { data: renderRows, error: renderError } = await supabase
    .from("take_renders")
    .select("id, take_id, status, latest_artifact_id")
    .eq("take_id", videoTakeId)
    .eq("format", "mp4");
  if (renderError) throw new Error(`動画Renderを読めませんでした: ${renderError.message}`);
  const render = (renderRows as Render[] | null)?.[0];
  assert(render?.status === "ready" && render.latest_artifact_id, "動画Renderがreadyではありません");

  const { data: artifactRow, error: artifactError } = await supabase
    .from("render_artifacts")
    .select("id, r2_key, bytes, checksum")
    .eq("id", render.latest_artifact_id!)
    .single();
  if (artifactError || !artifactRow) {
    throw new Error(artifactError?.message ?? "最新Artifactが見つかりません");
  }
  const artifact = artifactRow as Artifact;
  const artifactStat = await headR2Object(artifact.r2_key);
  assert(artifactStat, "動画ArtifactがR2にありません");
  assert(
    artifact.bytes === null || artifactStat.size === artifact.bytes,
    "動画ArtifactのサイズがDBと一致しません",
  );

  console.log("v2 event-work audit: OK");
  console.log(`work: ${video.work_id}`);
  console.log(`shared materials: ${videoMaterialIds.size} (R2 verified)`);
  console.log(`video artifact: ${artifact.bytes} bytes / ${artifact.checksum ?? "checksumなし"}`);
  console.log("LP: campaign-lp Take exists; Service Brand Kit is intentionally unresolved");
  // Keep this non-empty so accidental removal of the R2 checks is obvious in
  // review, while avoiding per-file noise during routine verification.
  void materialStats;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
