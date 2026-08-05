// Create the LP-side half of the Work-material sharing proof.
//
// The current campaign-lp renderer still consumes a Service Brand Kit from a
// legacy campaign job. This event has none, so the Take is deliberately
// created with its Kit fields null: a valid, visible collection task rather
// than invented marketing facts. Its input pins nonetheless prove that the
// same Work materials can be consumed by a video and an LP.

import { createAdminSupabase } from "@/lib/supabase/server";
import { createTake } from "@/lib/takes/create";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};
const dryRun = args.includes("--dry-run");

type VideoTake = {
  id: string;
  brand_id: string;
  work_id: string | null;
  title: string;
  created_by: string | null;
};
type Input = { material_id: string; role: string; checksum: string };

async function main() {
  const videoTakeId = flag("video-take");
  if (!videoTakeId) throw new Error("--video-take <UUID> が必要です");

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("takes")
    .select("id, brand_id, work_id, title, created_by, template_id")
    .eq("id", videoTakeId)
    .eq("template_id", "event-promo")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "event-promo Takeが見つかりません");
  const videoTake = data as VideoTake;
  if (!videoTake.work_id) throw new Error("動画TakeにWorkがありません。先に素材をWorkへ移してください。");
  if (!videoTake.created_by) throw new Error("動画Takeの作成者が無いためLP Takeを作成できません");

  const title = `${videoTake.title} LP（素材共有検証）`;
  const { data: existing, error: existingError } = await supabase
    .from("takes")
    .select("id")
    .eq("work_id", videoTake.work_id)
    .eq("template_id", "campaign-lp")
    .eq("title", title)
    .maybeSingle();
  if (existingError) throw new Error(`既存LP Takeを読めませんでした: ${existingError.message}`);

  const { data: inputs, error: inputsError } = await supabase
    .from("take_inputs")
    .select("material_id, role, checksum")
    .eq("take_id", videoTake.id);
  if (inputsError) throw new Error(`動画の入力素材を読めませんでした: ${inputsError.message}`);
  const videoInputs = (inputs ?? []) as Input[];
  if (videoInputs.length === 0) throw new Error("動画Takeに入力素材がありません");

  console.log(`work: ${videoTake.work_id}\nvideo inputs: ${videoInputs.length}`);
  if (existing) {
    console.log(`lp take: ${existing.id}（既存。変更しません）`);
    return;
  }
  if (dryRun) {
    console.log("LP brief: Service Brand Kit未充足（収集タスクとして保持）\n--dry-run: DBは変更しません");
    return;
  }

  const created = await createTake(supabase, {
    brandId: videoTake.brand_id,
    workId: videoTake.work_id,
    templateId: "campaign-lp",
    title,
    createdBy: videoTake.created_by,
    // campaign-lp's contract accepts unresolved Kit fields. Do not fabricate a
    // campaign job, source URL, or copy merely to make this proof look done.
    brief: { campaignJobId: null, sourceUrl: null, theme: null },
  });
  if (!created.ok) throw new Error(created.error);

  const { error: pinError } = await supabase.from("take_inputs").upsert(
    videoInputs.map((input) => ({ ...input, take_id: created.takeId })),
  );
  if (pinError) throw new Error(`LPへの素材固定に失敗しました: ${pinError.message}`);

  console.log(`lp take: ${created.takeId}\nrender: ${created.renderIds.join(", ")}\nshared inputs: ${videoInputs.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
