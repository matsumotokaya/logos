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
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { readCampaignJobHtml } from "@/lib/campaign/jobs";
import { renderLandingPage } from "@/lib/campaign/render-lp";
import { SAMPLE_CAMPAIGN_ID, sampleCampaignKit } from "@/lib/campaign/sample";

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
      renderLandingPage(sampleCampaignKit),
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

  const html = readCampaignJobHtml(id);
  if (!html) return Response.json({ error: "LPが見つかりません" }, { status: 404 });
  return htmlResponse(html, "private, no-store");
}
