// Stream a take's rendered MP4 out of R2.
//
// Signed rather than Authorization-gated because a <video> element cannot send
// headers — the same model the mockup and campaign-video routes already use.
// R2 stays private; the browser only ever talks to this origin.
//
// The signature covers the object key, so this route needs no database read.
// That is not just an optimisation: a signed request carries no user token, and
// brand_assets is readable only through `can_manage_brand_entity`, so a route
// that tried to look the key up would always 404 on exactly the requests it
// exists to serve. Binding the key into the signature also means a signature
// cannot be repointed at another take's object.
//
// Range requests are answered from R2 directly, so seeking never pulls the
// whole file into the server's memory.

import { labsEnabled, labsDisabledResponse } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { getR2ObjectRange, headR2Object, takeOutputKey } from "@/lib/video/storage";

/** Signature payload: the take and the exact object it may serve. */
export const outputSignatureToken = (videoId: string, key: string): string =>
  `take-video:${videoId}:${key}`;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; videoId: string }> },
) {
  if (!labsEnabled()) return labsDisabledResponse();
  const { id: brandId, videoId } = await ctx.params;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("Not found", { status: 404 });

  // The key must live under this take's own prefix. Redundant given the
  // signature, but it keeps a signing mistake from turning into a way to read
  // arbitrary objects out of the bucket.
  if (!key.startsWith(takeOutputKey(brandId, videoId, ""))) {
    return new Response("Not found", { status: 404 });
  }
  if (
    !verifyLabsSignature(
      outputSignatureToken(videoId, key),
      url.searchParams.get("exp"),
      url.searchParams.get("sig"),
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const stat = await headR2Object(key);
  if (!stat) return new Response("Not found", { status: 404 });

  const contentType = stat.contentType ?? "video/mp4";
  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);

  if (!match) {
    const body = await getR2ObjectRange(key, 0, stat.size - 1);
    if (!body) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }

  const chunk = await getR2ObjectRange(key, start, end);
  if (!chunk) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(chunk), {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
