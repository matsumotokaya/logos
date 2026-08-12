// Stream one pinned input material out of private R2 storage.
//
// The browser preview runs the same Remotion composition the renderer does, so
// it fetches the brief's photos, logos and BGM directly — and an <img>/<audio>
// element cannot attach an Authorization header. The video route resolves the
// take's pinned materials while it still holds the caller's token and mints
// same-origin signed URLs pointing here; the signature binds the exact R2 key
// to this brand/take/material path.
//
// Like the render-output route, this deliberately performs no database lookup:
// the signed request carries no user token, and brand_materials is closed by
// RLS. Everything this route is allowed to serve is already in the signature.

import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";
import { verifyLabsSignature } from "@/lib/labs-output-sign";
import { takeMaterialSignatureToken } from "@/lib/takes/material-uri";
import { parseByteRange } from "@/lib/video/byte-range";
import { getR2ObjectRange, headR2Object } from "@/lib/video/storage";

// The trailing [name] segment is the material's own filename. It is never read
// here — the signature binds the object — but it keeps the URL's last segment
// meaningful for the slot list and gives media players the extension they sniff
// formats from. It mirrors the `materials/<id>/<name>` layout the renderer
// stages into, so preview and export address the same file the same way.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; takeId: string; materialId: string }> },
) {
  if (!labsEnabled()) return labsDisabledResponse();

  const { id: brandId, takeId, materialId } = await ctx.params;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  // Materials live under the brand, at brand / work / take scope alike, so the
  // brand prefix is the one bound property every scope shares.
  if (!key || !key.startsWith(`brands/${brandId}/`)) {
    return new Response("Not found", { status: 404 });
  }
  if (
    !verifyLabsSignature(
      takeMaterialSignatureToken(brandId, takeId, materialId, key),
      url.searchParams.get("exp"),
      url.searchParams.get("sig"),
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const stat = await headR2Object(key);
  if (!stat) return new Response("Not found", { status: 404 });

  // Stored with its media type on upload; fall back to bytes rather than
  // guessing a type the player would then mis-decode.
  const contentType = stat.contentType ?? "application/octet-stream";
  // Range matters for the BGM track: media players seek rather than download.
  const range = parseByteRange(req.headers.get("range"), stat.size);

  if (range.kind === "invalid") {
    return new Response("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }

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
