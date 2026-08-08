// Permanent public video URL. Publication.status='live' is the only publicness
// decision; v2 tables remain closed to anon and are resolved server-side.

import { createAdminSupabase } from "@/lib/supabase/server";
import { parseByteRange } from "@/lib/video/byte-range";
import { getR2ObjectRange, headR2Object } from "@/lib/video/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createAdminSupabase();
  const { data: publication } = await admin
    .from("publications")
    .select("render_id")
    .eq("surface", "canonical_url")
    .eq("url_path", `/v/${id}`)
    .eq("status", "live")
    .maybeSingle();
  if (!publication) return new Response("Not found", { status: 404 });

  const { data: render } = await admin
    .from("take_renders")
    .select("latest_artifact_id")
    .eq("id", publication.render_id)
    .eq("format", "mp4")
    .eq("status", "ready")
    .maybeSingle();
  if (!render?.latest_artifact_id) return new Response("Not found", { status: 404 });

  const { data: artifact } = await admin
    .from("render_artifacts")
    .select("r2_key, media_type")
    .eq("id", render.latest_artifact_id)
    .eq("status", "ready")
    .maybeSingle();
  if (!artifact || artifact.media_type !== "video/mp4") {
    return new Response("Not found", { status: 404 });
  }

  const stat = await headR2Object(artifact.r2_key);
  if (!stat || stat.size <= 0) return new Response("Not found", { status: 404 });
  const range = parseByteRange(req.headers.get("range"), stat.size);
  if (range.kind === "none") {
    const body = await getR2ObjectRange(artifact.r2_key, 0, stat.size - 1);
    if (!body) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=300",
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
  const chunk = await getR2ObjectRange(artifact.r2_key, start, end);
  if (!chunk) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(chunk), {
    status: 206,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(chunk.byteLength),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=300",
    },
  });
}
