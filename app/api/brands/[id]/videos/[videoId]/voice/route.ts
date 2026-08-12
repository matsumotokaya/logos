// Speak this video's narration.
//
// The last step that turns a proposal into a film: the script is read aloud,
// the WAV is pinned to the take, and the timeline stops estimating from
// character counts and starts following the measured track.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { generateNarration, narrationVoiceAvailable } from "@/lib/narration/voice";
import { attachTakeNarration } from "@/lib/takes/narration";
import {
  EVENT_CM_SCENE_ROLES,
  type EventCmBrief,
} from "@/remotion/event-cm/types";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

/** How the narrator reads an event announcement — measured, not a hard sell. */
const EVENT_CM_PERSONA =
  "落ち着いた語り口のナレーター。抑揚は控えめに、言葉のあいだを丁寧に置いて読み上げます。";

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

  const { data: take, error } = await supabase
    .from("takes")
    .select("id, template_id, brief")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();
  if (error) {
    return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  }
  if (!take) return Response.json({ error: "動画が見つかりません" }, { status: 404 });
  if (take.template_id !== "event-cm") {
    return Response.json(
      { error: "このテンプレートはこの経路で音声を作りません" },
      { status: 400 },
    );
  }
  if (!narrationVoiceAvailable()) {
    return Response.json(
      { error: "音声の生成が設定されていません（GEMINI_API_KEY / CAMPAIGN_TTS_MOCK）" },
      { status: 503 },
    );
  }

  const brief = take.brief as EventCmBrief;
  const scenes = brief.script?.scenes ?? [];
  if (scenes.length !== EVENT_CM_SCENE_ROLES.length) {
    return Response.json(
      { error: "先に台本を作成してください" },
      { status: 409 },
    );
  }

  try {
    const { wav, track } = await generateNarration(scenes, {
      persona: EVENT_CM_PERSONA,
    });
    const attached = await attachTakeNarration(supabase, {
      takeId: take.id as string,
      brandId,
      userId: user.id,
      wav,
      track,
      role: "event_cm_voice",
      label: "イベント紹介動画のナレーション",
      sourceRef: { script_updated_at: brief.script.updatedAt },
    });
    return Response.json({
      ok: true,
      materialId: attached.materialId,
      totalMs: track.totalMs,
      mock: track.mock,
    });
  } catch (voiceError) {
    return Response.json(
      {
        error:
          voiceError instanceof Error
            ? voiceError.message
            : "ナレーション音声を作成できませんでした",
      },
      { status: 502 },
    );
  }
}
