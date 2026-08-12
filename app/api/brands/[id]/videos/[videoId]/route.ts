// One video of one brand.
//
// The path segment is always a V2 Take id. PATCH updates its validated brief,
// title, or canonical publication state.

import { guardLabsRequest } from "@/lib/labs-access";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { type VideoState } from "@/lib/video/asset";
import { VIDEO_TEMPLATES } from "@/lib/video/templates";
import { renderOutputSignatureToken } from "../../takes/[takeId]/renders/[renderId]/output/route";
import { resolveBriefMaterialUrls } from "@/lib/takes/materials";
import { validateBrief } from "@/lib/templates/brief-schemas";
import {
  ensureCanonicalVideoPublication,
  retireCanonicalPublications,
} from "@/lib/takes/publication";

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

  const { data: take, error: takeError } = await supabase
    .from("takes")
    .select("id, brand_id, template_id, title, brief, created_at")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();
  if (takeError) {
    return Response.json({ error: "動画を取得できませんでした" }, { status: 500 });
  }
  if (take) {
    const { data: render, error: renderError } = await supabase
      .from("take_renders")
      .select("id, status, latest_artifact_id, updated_at")
      .eq("take_id", take.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (renderError || !render) {
      return Response.json({ error: "動画の出力単位を取得できませんでした" }, { status: 500 });
    }
    const [artifactResult, publicationResult] = await Promise.all([
      render.latest_artifact_id
        ? supabase
            .from("render_artifacts")
            .select("r2_key, created_at")
            .eq("id", render.latest_artifact_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("publications")
        .select("id, url_path")
        .eq("render_id", render.id)
        .eq("status", "live")
        .limit(1),
    ]);
    if (artifactResult.error || publicationResult.error) {
      return Response.json({ error: "動画の成果物を取得できませんでした" }, { status: 500 });
    }
    // The client renders this brief in a Remotion Player, so its material
    // pointers have to become URLs a browser can fetch. Resolving here — while
    // the caller's token is still in hand — keeps the pinned-input check on the
    // server and the private R2 keys off the wire.
    let briefForClient = take.brief;
    let unresolvedMaterials: string[] = [];
    try {
      const resolvedBrief = await resolveBriefMaterialUrls(
        supabase,
        brandId,
        take.id as string,
        take.brief,
      );
      briefForClient = resolvedBrief.brief;
      unresolvedMaterials = resolvedBrief.unresolved;
    } catch {
      // A material read failure must not take the page down: the brief still
      // describes the video, and the slot list below the player is derived
      // from the same fields. The player shows what it can fetch.
    }

    const artifact = artifactResult.data;
    const mp4Url = artifact
      ? signedLabsUrl(
          `/api/brands/${brandId}/takes/${take.id}/renders/${render.id}/output?key=${encodeURIComponent(artifact.r2_key)}`,
          renderOutputSignatureToken(brandId, take.id, render.id, artifact.r2_key),
        )
      : null;
    const briefRecord = take.brief as Record<string, unknown> | null;
    const eventBrief = take.template_id === "event-promo" ? briefForClient : null;
    const campaignJobId =
      typeof briefRecord?.campaignJobId === "string"
        ? briefRecord.campaignJobId
        : null;
    const hasPinnedVoice =
      briefRecord?.voice != null && typeof briefRecord.voice === "object";
    const renderState =
      render.status === "running"
        ? { status: "running" as const, error: null, renderedAt: null }
        : render.status === "ready"
          ? {
              status: "done" as const,
              error: null,
              renderedAt: artifact?.created_at ?? render.updated_at,
            }
          : render.status === "failed"
            ? {
                status: "error" as const,
                error: "前回のレンダーに失敗しました",
                renderedAt: null,
              }
            : null;

    return Response.json({
      kind: "asset" as const,
      video: {
        render: renderState,
        mp4Url,
        id: take.id,
        brandId: take.brand_id,
        title: take.title,
        template: take.template_id,
        templateName: VIDEO_TEMPLATES[take.template_id]?.name ?? take.template_id,
        published: (publicationResult.data?.length ?? 0) > 0,
        publicUrl: publicationResult.data?.[0]?.url_path ?? null,
        briefSlug: null,
        brief: take.template_id === "event-promo" ? eventBrief : briefForClient,
        campaignJobId,
        unresolvedMaterials,
        state: artifact
          ? "mp4_ready"
          : take.template_id === "product-cm"
            ? hasPinnedVoice
              ? "preview_ready"
              : campaignVideoState(campaignJobId)
            : eventBrief
              ? "preview_ready"
              : "empty",
        createdAt: take.created_at,
      },
    });
  }

  return Response.json({ error: "動画が見つかりません" }, { status: 404 });
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

  const { data: take, error: takeReadError } = await supabase
    .from("takes")
    .select("id, template_id, brief")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();
  if (takeReadError) {
    return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  }
  if (take) {
    if (body.published === true) {
      const { data: render, error: renderError } = await supabase
        .from("take_renders")
        .select("id, status, latest_artifact_id")
        .eq("take_id", take.id)
        .eq("format", "mp4")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (renderError || !render) {
        return Response.json({ error: "動画Renderが見つかりません" }, { status: 409 });
      }
      if (render.status !== "ready" || !render.latest_artifact_id) {
        return Response.json({ error: "完成したMP4がない動画は公開できません" }, { status: 409 });
      }
      const published = await ensureCanonicalVideoPublication(supabase, {
        takeId: take.id as string,
        renderId: render.id as string,
        userId: user.id,
      });
      if (!published.ok) {
        return Response.json(
          {
            error: published.error.includes("row-level security")
              ? "動画を公開する権限がありません"
              : published.error,
          },
          { status: published.error.includes("row-level security") ? 403 : 409 },
        );
      }
    }
    if (body.published === false) {
      const { data: renders, error: rendersError } = await supabase
        .from("take_renders")
        .select("id")
        .eq("take_id", take.id);
      if (rendersError) {
        return Response.json({ error: "公開状態を確認できませんでした" }, { status: 500 });
      }
      const renderIds = (renders ?? []).map((render) => render.id as string);
      const retired = await retireCanonicalPublications(supabase, renderIds);
      if (!retired.ok) {
        return Response.json({ error: "公開を終了できませんでした" }, { status: 500 });
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.brief && typeof body.brief === "object") {
      const validated = validateBrief(take.template_id as string, body.brief);
      if (!validated.ok) {
        return Response.json(
          { error: `ブリーフが不正です: ${validated.issues.join(", ")}` },
          { status: 400 },
        );
      }
      update.brief = validated.brief;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
    }
    if (Object.keys(update).length > 1) {
      const { error: updateError } = await supabase
        .from("takes")
        .update(update)
        .eq("id", take.id);
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "動画が見つかりません" }, { status: 404 });
}
