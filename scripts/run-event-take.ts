// Put one event-promo video through the v2 structure, end to end.
//
//   npm run takes:event -- [--brand <brandId>] [--dry-run]
//
// This is the "one template all the way through" check from
// docs/deliverable-architecture.md §9-3. It reads the brief off the EXISTING
// v1 video asset rather than the bundled seed, so it also answers a question a
// synthetic brief could not: does the schema match the data we actually have?
//
// It uses the service role, which bypasses RLS. That is fine for proving the
// structure holds, and it is NOT a check of the policies — those were verified
// separately when 0023-0031 were applied.
//
// Nothing is deleted and no v1 row is modified: the v2 take is created alongside
// what already works.

import { createAdminSupabase } from "@/lib/supabase/server";
import { EventBriefSchema, eventBriefGaps } from "@/remotion/event/brief-schema";
import { createTake } from "@/lib/takes/create";
import { renderTake } from "@/lib/takes/render";
import { headR2Object } from "@/lib/r2";

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};
const has = (name: string): boolean => args.includes(`--${name}`);

async function main() {
  const supabase = createAdminSupabase();

  const brandFilter = flag("brand");
  let query = supabase
    .from("brand_assets")
    .select("id, brand_id, title, metadata, created_by")
    .eq("asset_kind", "video")
    .eq("metadata->>template", "event-promo")
    .order("created_at", { ascending: true });
  if (brandFilter) query = query.eq("brand_id", brandFilter);

  const { data: assets, error } = await query;
  if (error) throw new Error(`v1 動画アセットを読めませんでした: ${error.message}`);
  const asset = assets?.[0];
  if (!asset) throw new Error("event-promo の v1 動画アセットが見つかりません");

  console.log(`v1 asset : ${asset.id}  「${asset.title}」`);
  console.log(`brand    : ${asset.brand_id}`);

  const metadata = asset.metadata as { brief?: unknown; briefSlug?: string } | null;
  const parsed = EventBriefSchema.safeParse(metadata?.brief);
  if (!parsed.success) {
    console.error("\nこの brief は EventBriefSchema に一致しません:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    // A real mismatch means the schema is wrong about the data we hold, which is
    // exactly what this run exists to surface. Do not paper over it.
    process.exit(1);
  }
  const brief = parsed.data;
  const gaps = eventBriefGaps(brief);
  console.log(
    `brief    : 形式OK / 未充足スロット ${gaps.length}件` +
      (gaps.length ? ` (${gaps.join(", ")})` : " — フォールバックで成立"),
  );

  if (has("dry-run")) {
    console.log("\n--dry-run: ここで停止（DBへは何も書きません）");
    return;
  }

  const created = await createTake(supabase, {
    brandId: asset.brand_id,
    templateId: "event-promo",
    brief,
    title: asset.title,
    createdBy: asset.created_by,
  });
  if (!created.ok) {
    console.error(`\nテイクを作成できませんでした: ${created.error}`);
    if (created.issues) for (const issue of created.issues) console.error(`  ${issue}`);
    process.exit(1);
  }
  console.log(
    `take     : ${created.takeId}  pinned to ${created.template.id}@${created.template.version}` +
      ` (brief schema v${created.template.briefSchemaVersion})`,
  );
  console.log(`renders  : ${created.renderIds.join(", ")}`);

  const renderId = created.renderIds[0];
  if (!renderId) throw new Error("既定の出力単位が作られませんでした");

  console.log("\nレンダー中（ローカルChromium・約30秒）…");
  const rendered = await renderTake(supabase, renderId);
  if (!rendered.ok) {
    console.error(`レンダー失敗: ${rendered.error}`);
    process.exit(1);
  }
  console.log(`artifact : ${rendered.artifactId}`);
  console.log(
    `r2       : ${rendered.r2Key}  ${(rendered.bytes / 1_000_000).toFixed(1)}MB`,
  );

  // Read it back: an upload that cannot be fetched is not a stored artifact.
  const stat = await headR2Object(rendered.r2Key);
  if (!stat) throw new Error("R2から読み戻せませんでした");
  console.log(
    `readback : ${stat.size} bytes / ${stat.contentType}` +
      (stat.size === rendered.bytes ? "  ✓ サイズ一致" : "  ✗ サイズ不一致"),
  );

  console.log(
    "\n公開(Publication)はまだ配信ルートが無いので作りません。" +
      "URLを持たない live 行を作ると「公開したのに開けない」状態になります。",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
