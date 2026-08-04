// Videos of one brand — the portal's list and its "add a video" action.
//
// GET returns the brand's video assets plus, always first, the brand's default
// product CM. That default is deliberately not a row: every brand is offered a
// product CM whether or not anyone generated one, so materialising a row for
// each brand would fill the table with empty placeholders. It becomes a real
// row only when a campaign has produced something (see campaignJobId below).
//
// POST creates a video asset. The template is chosen here and never changes.

import { guardLabsRequest } from "@/lib/labs-access";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { isVideoTemplateId, VIDEO_TEMPLATES } from "@/lib/video/templates";
import { parseVideoMetadata, type VideoState, type VideoSummary } from "@/lib/video/asset";
import { resolveCampaignJobId } from "@/lib/video/job-id";
import { bundledBrief, emptyEventBrief } from "@/remotion/event/briefs";

type AssetRow = {
  id: string;
  brand_id: string;
  asset_kind: string;
  title: string;
  status: string;
  metadata: unknown;
  created_at: string;
  generation_run_id: string | null;
  legacy_campaign_id: string | null;
  public_path: string | null;
};

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

/** MP4 on disk beats a voice track; neither means the slot is still empty. */
function campaignVideoState(jobId: string | null): VideoState {
  if (!jobId) return "empty";
  if (campaignCmMp4Exists(jobId)) return "mp4_ready";
  return getCampaignJob(jobId)?.cm?.track ? "preview_ready" : "empty";
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: brand, error: brandError } = await supabase
    .from("brand_entities")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();
  if (brandError) return Response.json({ error: "ブランドを確認できませんでした" }, { status: 500 });
  if (!brand) return Response.json({ error: "ブランドが見つかりません" }, { status: 404 });

  const [assetResult, runResult] = await Promise.all([
    supabase
      .from("brand_assets")
      .select(
        "id, brand_id, asset_kind, title, status, metadata, created_at, generation_run_id, legacy_campaign_id, public_path",
      )
      .eq("brand_id", brandId)
      .in("asset_kind", ["video", "lp"])
      .order("created_at", { ascending: true }),
    supabase.from("brand_generation_runs").select("id, external_job_id").eq("brand_id", brandId),
  ]);
  if (assetResult.error || runResult.error) {
    return Response.json({ error: "アセットを取得できませんでした" }, { status: 500 });
  }

  const rows = (assetResult.data ?? []) as AssetRow[];
  const runs = new Map(
    ((runResult.data ?? []) as { id: string; external_job_id: string | null }[]).map((run) => [
      run.id,
      run,
    ]),
  );

  // The product CM still lives on a campaign job, so the default entry reads
  // its state from the brand's most recent LP campaign.
  const latestLp = rows.filter((row) => row.asset_kind === "lp").at(-1) ?? null;
  const campaignJobId = latestLp ? resolveCampaignJobId(latestLp, runs) : null;

  const videos: VideoSummary[] = [];

  const persistedProductCm = rows.find(
    (row) => row.asset_kind === "video" && parseVideoMetadata(row.metadata)?.template === "product-cm",
  );
  if (!persistedProductCm) {
    videos.push({
      id: campaignJobId ?? "product-cm",
      brandId,
      template: "product-cm",
      title: `${brand.name} ${VIDEO_TEMPLATES["product-cm"].name}`,
      published: false,
      state: campaignVideoState(campaignJobId),
      createdAt: latestLp?.created_at ?? new Date(0).toISOString(),
      isPlaceholder: true,
    });
  }

  for (const row of rows) {
    if (row.asset_kind !== "video") continue;
    const meta = parseVideoMetadata(row.metadata);
    if (!meta) continue;
    videos.push({
      id: row.id,
      brandId: row.brand_id,
      template: meta.template,
      title: row.title,
      published: meta.published,
      state:
        meta.template === "product-cm"
          ? campaignVideoState(meta.campaignJobId ?? campaignJobId)
          : // An event promo renders from its brief alone, so a stored brief is
            // already previewable — there is nothing to generate first.
            meta.brief
            ? "preview_ready"
            : "empty",
      createdAt: row.created_at,
      isPlaceholder: false,
    });
  }

  return Response.json({ brand: { id: brand.id, name: brand.name }, videos });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  let body: { template?: unknown; title?: unknown; briefSlug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "リクエストを解釈できませんでした" }, { status: 400 });
  }

  const template = typeof body.template === "string" ? body.template : "";
  if (!isVideoTemplateId(template)) {
    return Response.json({ error: "テンプレートが不正です" }, { status: 400 });
  }
  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
  const briefSlug = typeof body.briefSlug === "string" ? body.briefSlug : "";

  const metadata: Record<string, unknown> = { template, published: false, createdVia: "portal" };
  let title = requestedTitle;

  if (template === "event-promo") {
    const seed = briefSlug ? bundledBrief(briefSlug) : null;
    if (briefSlug && !seed) {
      return Response.json(
        { error: `ブリーフが見つかりません: ${briefSlug}` },
        { status: 400 },
      );
    }
    // Copy the seed so the row owns its brief from here on.
    const brief = seed ? structuredClone(seed.brief) : emptyEventBrief(title || "新しいイベント動画");
    if (!title) title = seed ? seed.brief.title : "新しいイベント動画";
    if (seed) metadata.briefSlug = seed.slug;
    metadata.brief = brief;
  } else {
    // product-cm is driven by the campaign pipeline; the row records which job
    // owns the Brand Kit and narration.
    const [lpResult, runResult] = await Promise.all([
      supabase
        .from("brand_assets")
        .select("generation_run_id, legacy_campaign_id, public_path")
        .eq("brand_id", brandId)
        .eq("asset_kind", "lp")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("brand_generation_runs").select("id, external_job_id").eq("brand_id", brandId),
    ]);
    const runs = new Map(
      ((runResult.data ?? []) as { id: string; external_job_id: string | null }[]).map((run) => [
        run.id,
        run,
      ]),
    );
    const jobId = lpResult.data ? resolveCampaignJobId(lpResult.data, runs) : null;
    if (jobId) metadata.campaignJobId = jobId;
    if (!title) title = VIDEO_TEMPLATES["product-cm"].name;
  }

  const { data, error } = await supabase
    .from("brand_assets")
    .insert({
      brand_id: brandId,
      asset_kind: "video",
      title,
      status: "ready",
      source_kind: "generated",
      metadata,
      created_by: user.id,
    })
    .select("id, created_at")
    .maybeSingle();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "動画を作成できませんでした" },
      { status: 500 },
    );
  }

  return Response.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
}
