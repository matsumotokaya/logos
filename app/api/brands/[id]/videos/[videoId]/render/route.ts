// Render one event-promo take to MP4 and store it in R2.
//
// Fire-and-forget with the state kept on the take's own row, mirroring the
// campaign CM route: a render takes minutes, so the request returns 202 and the
// detail screen polls. Progress lives in metadata.render rather than in memory
// so a reload — or a different machine — still sees what happened.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { parseVideoMetadata } from "@/lib/video/asset";
import { renderEventTake } from "@/lib/video/render-event";

export const maxDuration = 300;

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; videoId: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId, videoId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: row, error } = await supabase
    .from("brand_assets")
    .select("id, metadata")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("asset_kind", "video")
    .maybeSingle();
  if (error) return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  if (!row) return Response.json({ error: "動画が見つかりません" }, { status: 404 });

  const meta = parseVideoMetadata(row.metadata);
  if (!meta) {
    return Response.json({ error: "動画の構成を読み取れませんでした" }, { status: 500 });
  }
  if (meta.template !== "event-promo") {
    return Response.json(
      { error: "この動画は製品紹介動画です。CM画面から作成してください" },
      { status: 409 },
    );
  }
  if (!meta.brief) {
    return Response.json({ error: "ブリーフがありません" }, { status: 409 });
  }

  const current = (row.metadata as Record<string, unknown>) ?? {};
  const renderState = current.render as { status?: string } | undefined;
  if (renderState?.status === "running") {
    return Response.json({ status: "running" }, { status: 202 });
  }

  const writeMetadata = async (render: Record<string, unknown>) => {
    await supabase
      .from("brand_assets")
      .update({ metadata: { ...current, render }, updated_at: new Date().toISOString() })
      .eq("id", videoId);
  };

  await writeMetadata({ status: "running", startedAt: new Date().toISOString() });

  // Not awaited: the response must not wait minutes. Failures are recorded on
  // the row, which is the only place a later reader can learn about them.
  void renderEventTake(brandId, videoId, meta.brief)
    .then((result) =>
      writeMetadata({
        status: "done",
        mp4Key: result.key,
        bytes: result.bytes,
        renderedAt: result.renderedAt,
      }),
    )
    .catch(async (e) => {
      console.error("Event MP4 render failed:", e);
      await writeMetadata({
        status: "error",
        error: e instanceof Error ? e.message : "MP4を作成できませんでした",
        failedAt: new Date().toISOString(),
      });
    });

  return Response.json({ status: "running" }, { status: 202 });
}
