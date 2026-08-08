// Videos of one brand — the portal's list and its "add a video" action.
//
// Every listed video is a V2 Take. POST chooses the immutable template and
// creates that Take; there are no synthetic rows or legacy asset fallbacks.

import { guardLabsRequest } from "@/lib/labs-access";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { isVideoTemplateId, VIDEO_TEMPLATES } from "@/lib/video/templates";
import { type VideoState, type VideoSummary } from "@/lib/video/asset";
import { bundledBrief, emptyEventBrief } from "@/remotion/event/briefs";
import { createTake } from "@/lib/takes/create";

type TakeVideoRow = {
  id: string;
  brand_id: string;
  template_id: string;
  title: string;
  brief: unknown;
  created_at: string;
  take_renders: Array<{
    status: string;
    latest_artifact_id: string | null;
    publications: Array<{ status: string }> | null;
  }> | null;
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

  const [takeResult, lpTakeResult] = await Promise.all([
    supabase
      .from("takes")
      .select(
        "id, brand_id, template_id, title, brief, created_at, take_renders(status, latest_artifact_id, publications(status))",
      )
      .eq("brand_id", brandId)
      .eq("tool_kind", "video")
      .order("created_at", { ascending: true }),
    supabase
      .from("takes")
      .select("brief")
      .eq("brand_id", brandId)
      .eq("template_id", "campaign-lp")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (takeResult.error || lpTakeResult.error) {
    return Response.json({ error: "アセットを取得できませんでした" }, { status: 500 });
  }
  const lpBrief = lpTakeResult.data?.brief as Record<string, unknown> | null;
  const campaignJobId =
    typeof lpBrief?.campaignJobId === "string" ? lpBrief.campaignJobId : null;

  const videos: VideoSummary[] = [];
  const v2Videos = (takeResult.data ?? []) as unknown as TakeVideoRow[];
  for (const take of v2Videos) {
    if (!isVideoTemplateId(take.template_id)) continue;
    const brief = take.brief as Record<string, unknown> | null;
    const renderReady = (take.take_renders ?? []).some(
      (render) => render.status === "ready" && render.latest_artifact_id,
    );
    const published = (take.take_renders ?? []).some((render) =>
      (render.publications ?? []).some((publication) => publication.status === "live"),
    );
    const takeJobId =
      typeof brief?.campaignJobId === "string" ? brief.campaignJobId : null;
    videos.push({
      id: take.id,
      brandId: take.brand_id,
      template: take.template_id,
      title: take.title,
      published,
      state:
        take.template_id === "product-cm"
          ? campaignVideoState(takeJobId ?? campaignJobId)
          : renderReady
            ? "mp4_ready"
            : take.brief
              ? "preview_ready"
              : "empty",
      createdAt: take.created_at,
      isPlaceholder: false,
    });
  }

  videos.sort((left, right) => {
    if (left.template === right.template) {
      return left.createdAt.localeCompare(right.createdAt);
    }
    if (left.template === "product-cm") return -1;
    if (right.template === "product-cm") return 1;
    return 0;
  });

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

  let title = requestedTitle;
  let brief: unknown;

  if (template === "event-promo") {
    const seed = briefSlug ? bundledBrief(briefSlug) : null;
    if (briefSlug && !seed) {
      return Response.json(
        { error: `ブリーフが見つかりません: ${briefSlug}` },
        { status: 400 },
      );
    }
    // Copy the seed so the row owns its brief from here on.
    brief = seed ? structuredClone(seed.brief) : emptyEventBrief(title || "新しいイベント動画");
    if (!title) title = seed ? seed.brief.title : "新しいイベント動画";
  } else {
    // product-cm is driven by the campaign pipeline; the row records which job
    // owns the Brand Kit and narration.
    const { data: lpTake, error: lpTakeError } = await supabase
      .from("takes")
      .select("brief")
      .eq("brand_id", brandId)
      .eq("template_id", "campaign-lp")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lpTakeError) {
      return Response.json(
        { error: "製品紹介動画のBrand Kitを確認できませんでした" },
        { status: 500 },
      );
    }
    const lpTakeBrief = lpTake?.brief as Record<string, unknown> | null;
    const jobId =
      typeof lpTakeBrief?.campaignJobId === "string" ? lpTakeBrief.campaignJobId : null;
    const job = jobId ? getCampaignJob(jobId) : null;
    brief = {
      kit: lpTakeBrief?.kit ?? job?.kit ?? null,
      campaignJobId: jobId,
      sourceUrl:
        (typeof lpTakeBrief?.sourceUrl === "string" ? lpTakeBrief.sourceUrl : null) ??
        job?.input.url ??
        null,
      theme:
        (typeof lpTakeBrief?.theme === "string" ? lpTakeBrief.theme : null) ??
        job?.kit?.theme ??
        null,
    };
    if (!title) title = VIDEO_TEMPLATES["product-cm"].name;
  }

  const created = await createTake(supabase, {
    brandId,
    templateId: template,
    title,
    brief,
    createdBy: user.id,
  });
  if (!created.ok) {
    return Response.json(
      { error: created.error },
      { status: 500 },
    );
  }

  return Response.json(
    { id: created.takeId, createdAt: new Date().toISOString() },
    { status: 201 },
  );
}
