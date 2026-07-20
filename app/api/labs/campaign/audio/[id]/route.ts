// GET: the CM voice track (WAV) of a campaign job, via a short-lived HMAC
// signature — the Remotion <Audio> element can't send an Authorization
// header, same constraint as /c/[id]. The sample campaign's audio is a
// static file under public/campaigns/ and never hits this route.

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { readCampaignCmWav } from "@/lib/campaign/jobs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!labsEnabled()) return labsDisabledResponse();

  const url = new URL(req.url);
  if (
    !verifyLabsSignature(
      `campaign-audio:${id}`,
      url.searchParams.get("exp"),
      url.searchParams.get("sig")
    )
  ) {
    return labsDisabledResponse();
  }

  const wav = readCampaignCmWav(id);
  if (!wav)
    return Response.json({ error: "音声が見つかりません" }, { status: 404 });
  return new Response(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, no-store",
    },
  });
}
