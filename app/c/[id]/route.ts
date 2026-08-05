// /c/[id] — canonical public URL of a generated campaign sales page.
//
// Mirrors /p/[id] (logo presentations): a flat opaque ID that never encodes
// the owner, so ownership transfers never break the link. `/c/sample` is the
// bundled sample (CM Maker's own sales page, the /campaigns placeholder).
//
// Interim access model (job-store phase, before the `campaigns` table):
// generated pages are reachable only through a short-lived HMAC signature
// issued by the jobs API — a browser navigation can't send an Authorization
// header. Once campaigns get owners + visibility in the DB, this switches to
// the same RLS-driven model as /p/[id].

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { getR2Object } from "@/lib/r2";
import { createAdminSupabase } from "@/lib/supabase/server";
import { signedLabsUrl, verifyLabsSignature } from "@/lib/labs-output-sign";
import { campaignCmMp4Exists, readCampaignJobHtml } from "@/lib/campaign/jobs";
import {
  cmVideoEmbed,
  injectCmVideo,
  removeCmVideoSlot,
  renderLandingPage,
} from "@/lib/campaign/render-lp";
import {
  SAMPLE_CAMPAIGN_ID,
  SAMPLE_CM_VIDEO,
  sampleCampaignKit,
} from "@/lib/campaign/sample";

function htmlResponse(html: string, cacheControl: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": cacheControl,
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (id === SAMPLE_CAMPAIGN_ID) {
    return htmlResponse(
      renderLandingPage(sampleCampaignKit, {
        videoEmbed: cmVideoEmbed(SAMPLE_CM_VIDEO),
      }),
      "public, max-age=300"
    );
  }

  // v2 public resolution is server-only. New tables stay closed to anon RLS;
  // Publication.status='live' is the single publicness decision.
  const admin = createAdminSupabase();
  const { data: publication } = await admin
    .from("publications")
    .select("render_id")
    .eq("surface", "canonical_url")
    .eq("url_path", `/c/${id}`)
    .eq("status", "live")
    .maybeSingle();
  if (publication) {
    const { data: render } = await admin
      .from("take_renders")
      .select("latest_artifact_id")
      .eq("id", publication.render_id)
      .maybeSingle();
    if (!render?.latest_artifact_id) return Response.json({ error: "LPが見つかりません" }, { status: 404 });
    const { data: artifact } = await admin
      .from("render_artifacts")
      .select("r2_key, media_type")
      .eq("id", render.latest_artifact_id)
      .maybeSingle();
    if (!artifact) return Response.json({ error: "LPが見つかりません" }, { status: 404 });
    const html = await getR2Object(artifact.r2_key);
    if (!html) return Response.json({ error: "LPが見つかりません" }, { status: 404 });
    return new Response(new Uint8Array(html).buffer, {
      headers: { "Content-Type": artifact.media_type, "Cache-Control": "public, max-age=300" },
    });
  }

  if (!labsEnabled()) return labsDisabledResponse();
  const url = new URL(req.url);
  if (
    !verifyLabsSignature(
      `campaign-lp:${id}`,
      url.searchParams.get("exp"),
      url.searchParams.get("sig")
    )
  ) {
    return labsDisabledResponse();
  }

  let html = readCampaignJobHtml(id);
  if (!html) return Response.json({ error: "LPが見つかりません" }, { status: 404 });

  // The MP4 is the single fact this page reads about the video: present, the
  // slot carries the embed with a freshly signed URL on every serve; absent,
  // the page shows no video section at all. The MP4 is rendered automatically
  // once the CM voice stage finishes, so "absent" means "not ready yet", never
  // "the visitor should press something".
  html = campaignCmMp4Exists(id)
    ? injectCmVideo(
        html,
        signedLabsUrl(`/api/labs/campaign/video/${id}`, `campaign-video:${id}`)
      )
    : removeCmVideoSlot(html);
  return htmlResponse(html, "private, no-store");
}
