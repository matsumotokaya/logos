// One video of one brand.
//
// The path segment can be either a brand_assets id (a real video row) or a
// campaign job id (the brand's default product CM, which has no row yet). Both
// are UUIDs, so they cannot be told apart by shape — this route does the lookup
// and tells the client which it is, so the disambiguation lives in one place
// instead of being guessed in the UI.
//
// PATCH updates the stored payload: the brief for an event promo, or the
// published flag. The row's metadata is the source of truth after creation, so
// editing a video never means editing repo code.

import { guardLabsRequest } from "@/lib/labs-access";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { parseVideoMetadata, type EventRenderState, type VideoState } from "@/lib/video/asset";
import { VIDEO_TEMPLATES } from "@/lib/video/templates";
import { outputSignatureToken } from "./output/route";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

function campaignVideoState(jobId: string | null): VideoState {
  if (!jobId) return "empty";
  if (campaignCmMp4Exists(jobId)) return "mp4_ready";
  return getCampaignJob(jobId)?.cm?.track ? "preview_ready" : "empty";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; videoId: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId, videoId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: row, error } = await supabase
    .from("brand_assets")
    .select("id, brand_id, asset_kind, title, status, metadata, created_at")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("asset_kind", "video")
    .maybeSingle();
  if (error) {
    return Response.json({ error: "動画を取得できませんでした" }, { status: 500 });
  }

  if (row) {
    const meta = parseVideoMetadata(row.metadata);
    if (!meta) {
      return Response.json({ error: "動画の構成を読み取れませんでした" }, { status: 500 });
    }
    // The MP4 lives in R2 and is played through a signed same-origin URL —
    // <video> cannot send an Authorization header, so the URL is minted here,
    // where the caller is already authenticated.
    const render = (row.metadata as { render?: EventRenderState } | null)?.render ?? null;
    const mp4Url =
      render?.status === "done" && render.mp4Key
        ? signedLabsUrl(
            `/api/brands/${brandId}/videos/${videoId}/output?key=${encodeURIComponent(render.mp4Key)}`,
            outputSignatureToken(videoId, render.mp4Key),
          )
        : null;
    return Response.json({
      kind: "asset" as const,
      video: {
        render: render
          ? { status: render.status, error: render.error ?? null, renderedAt: render.renderedAt ?? null }
          : null,
        mp4Url,
        id: row.id,
        brandId: row.brand_id,
        title: row.title,
        template: meta.template,
        templateName: VIDEO_TEMPLATES[meta.template]?.name ?? meta.template,
        published: meta.published,
        briefSlug: meta.briefSlug ?? null,
        brief: meta.brief ?? null,
        campaignJobId: meta.campaignJobId ?? null,
        state:
          meta.template === "product-cm"
            ? campaignVideoState(meta.campaignJobId ?? null)
            : meta.brief
              ? "preview_ready"
              : "empty",
        createdAt: row.created_at,
      },
    });
  }

  // No row: treat the segment as the campaign job behind the brand's default
  // product CM. The legacy campaign screen renders it.
  return Response.json({ kind: "campaign" as const, jobId: videoId });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; videoId: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId, videoId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  let body: { published?: unknown; brief?: unknown; title?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "リクエストを解釈できませんでした" }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from("brand_assets")
    .select("id, metadata")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("asset_kind", "video")
    .maybeSingle();
  if (readError) {
    return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  }
  if (!row) return Response.json({ error: "動画が見つかりません" }, { status: 404 });

  const meta = parseVideoMetadata(row.metadata);
  if (!meta) {
    return Response.json({ error: "動画の構成を読み取れませんでした" }, { status: 500 });
  }

  const nextMetadata: Record<string, unknown> = { ...meta };
  if (typeof body.published === "boolean") nextMetadata.published = body.published;
  if (body.brief && typeof body.brief === "object") nextMetadata.brief = body.brief;

  const update: Record<string, unknown> = {
    metadata: nextMetadata,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();

  const { error: writeError } = await supabase
    .from("brand_assets")
    .update(update)
    .eq("id", videoId);
  if (writeError) {
    return Response.json({ error: writeError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
