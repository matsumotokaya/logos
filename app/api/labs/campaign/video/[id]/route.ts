// GET: the rendered CM MP4 of a campaign job, via a short-lived HMAC
// signature (same model as the audio/LP routes — <video> elements can't send
// an Authorization header). Supports single-range requests so browsers can
// seek. The sample campaign's MP4 is a static file under public/campaigns/.

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { readCampaignCmMp4 } from "@/lib/campaign/jobs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!labsEnabled()) return labsDisabledResponse();

  const url = new URL(req.url);
  if (
    !verifyLabsSignature(
      `campaign-video:${id}`,
      url.searchParams.get("exp"),
      url.searchParams.get("sig")
    )
  ) {
    return labsDisabledResponse();
  }

  const mp4 = readCampaignCmMp4(id);
  if (!mp4)
    return Response.json({ error: "動画が見つかりません" }, { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  };

  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    const start = match[1] ? parseInt(match[1], 10) : mp4.length - parseInt(match[2], 10);
    const end = match[1] && match[2] ? parseInt(match[2], 10) : mp4.length - 1;
    if (start >= 0 && start <= end && end < mp4.length) {
      return new Response(new Uint8Array(mp4.subarray(start, end + 1)), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${mp4.length}`,
        },
      });
    }
  }

  return new Response(new Uint8Array(mp4), { headers });
}
