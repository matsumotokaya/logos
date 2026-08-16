// Download this video as a Remotion project.
//
// Streams a zip rather than storing an artifact. The export is derived entirely
// from the take and the template source, so it is reproducible on demand and
// there is nothing worth keeping a copy of — an artifact row would age the
// moment the template changed, and hand the user a stale project that no longer
// matches the video they are looking at.
//
// Access is the same as the rest of the take's API: RLS decides, by asking for
// the row through the caller's own token.

import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { buildProjectZip } from "@/lib/export/project-zip";

/** Reads template sources from disk and material bytes from R2. */
export const maxDuration = 120;

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; videoId: string }> },
) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId, videoId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: take, error } = await supabase
    .from("takes")
    .select("id, title, template_id, brief, baked_brief, baked_at")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();

  if (error) return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  if (!take) return Response.json({ error: "動画が見つかりません" }, { status: 404 });
  if (take.template_id !== "event-cm") {
    return Response.json(
      { error: `${take.template_id} のプロジェクト書き出しはまだ用意できていません` },
      { status: 409 },
    );
  }

  // The baked brief where there is one: the download should be the video on
  // screen, not the edits that have not been applied to it yet.
  const brief = take.baked_brief ?? take.brief;
  if (!brief) return Response.json({ error: "この動画にはブリーフがありません" }, { status: 409 });

  try {
    const project = await buildProjectZip(supabase, {
      takeId: take.id as string,
      title: (take.title as string | null) ?? "video",
      brief,
      bakedAt: take.baked_at as string | null,
    });

    // Header values are ByteStrings, and an event is usually named in Japanese,
    // so the readable name has to travel percent-encoded (RFC 5987). The ASCII
    // `filename` stays as the fallback for anything that ignores `filename*`.
    const ascii = project.filename.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "");
    const disposition =
      `attachment; filename="${ascii}"; ` +
      `filename*=UTF-8''${encodeURIComponent(project.filename)}`;

    return new Response(project.zip as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": disposition,
        "Content-Length": String(project.zip.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "プロジェクトを書き出せませんでした";
    return Response.json({ error: message }, { status: 500 });
  }
}
