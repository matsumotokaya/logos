// GET: serve a generated LP as a real page (open-in-new-tab target).
//
// A browser navigation can't send an Authorization header, so access is
// gated by a short-lived HMAC signature issued by the jobs API — the same
// model as Generative Lab output images.

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { readCampaignJobHtml } from "@/lib/campaign/jobs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!labsEnabled()) return labsDisabledResponse();
  const { id } = await params;
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
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}
