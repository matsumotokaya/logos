// Stream one v2 render artifact out of private R2 storage.
//
// A <video> element cannot attach an Authorization header, so callers that
// have already resolved an artifact mint a same-origin signed URL.  The
// signature binds the exact R2 key to this brand/take/render path.  Do not add
// a database lookup here: the signed browser request has no user token and
// render_artifacts is intentionally closed by RLS.

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { parseByteRange } from "@/lib/video/byte-range";
import { getR2ObjectRange, headR2Object } from "@/lib/video/storage";

const renderOutputPrefix = (brandId: string, takeId: string, renderId: string): string =>
  `brands/${brandId}/takes/${takeId}/renders/${renderId}/`;

/** Signature payload: the route identity and exact object it may serve. */
export const renderOutputSignatureToken = (
  brandId: string,
  takeId: string,
  renderId: string,
  key: string,
): string => `take-render:${brandId}:${takeId}:${renderId}:${key}`;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; takeId: string; renderId: string }> },
) {
  if (!labsEnabled()) return labsDisabledResponse();

  const { id: brandId, takeId, renderId } = await ctx.params;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith(renderOutputPrefix(brandId, takeId, renderId))) {
    return new Response("Not found", { status: 404 });
  }
  if (
    !verifyLabsSignature(
      renderOutputSignatureToken(brandId, takeId, renderId, key),
      url.searchParams.get("exp"),
      url.searchParams.get("sig"),
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const stat = await headR2Object(key);
  if (!stat) return new Response("Not found", { status: 404 });

  const contentType = stat.contentType ?? "video/mp4";
  const range = parseByteRange(req.headers.get("range"), stat.size);

  if (range.kind === "none") {
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

  if (range.kind === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }
  const { start, end } = range;

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
