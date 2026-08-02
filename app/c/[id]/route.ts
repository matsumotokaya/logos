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
import { signedLabsUrl, verifyLabsSignature } from "@/lib/labs-output-sign";
import { campaignCmMp4Exists, readCampaignJobHtml } from "@/lib/campaign/jobs";
import {
  cmVideoEmbed,
  injectCmVideo,
  injectCmVideoAction,
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

  // The stored HTML predates the CM; once the MP4 exists, swap the video-slot
  // placeholder for the real embed with a freshly signed URL on every serve.
  if (campaignCmMp4Exists(id)) {
    html = injectCmVideo(
      html,
      signedLabsUrl(`/api/labs/campaign/video/${id}`, `campaign-video:${id}`)
    );
  } else {
    // Keep the paid generation endpoint behind the authenticated management
    // surface. The detail page consumes this one-shot intent and starts the
    // same CM job used by its own button.
    html = injectCmVideoAction(html, `/campaigns/${id}?generateVideo=1`);
  }
  return htmlResponse(html, "private, no-store");
}
