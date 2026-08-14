// Speak this video's narration.
//
// The last step that turns a proposal into a film: the script is read aloud,
// the WAV is pinned to the take, and the timeline stops estimating from
// character counts and starts following the measured track.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { generateNarration, narrationVoiceAvailable } from "@/lib/narration/voice";
import {
  DEFAULT_NARRATION_VOICE,
  narrationVoiceById,
  narrationVoiceByName,
} from "@/lib/narration/voices";
import { EVENT_CM_PERSONA } from "@/lib/event-cm/delivery";
import { attachTakeNarration } from "@/lib/takes/narration";
import { eventCmFilm } from "@/remotion/event-cm/film";
import { validateBrief } from "@/lib/templates/brief-schemas";
import { EVENT_CM_SCENE_GAP_MS } from "@/remotion/event-cm/timeline";
import { type EventCmBrief } from "@/remotion/event-cm/types";

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

  // Which voice reads it. Unknown ids fall back rather than failing: the take's
  // own recorded voice first (re-recording keeps the voice you had), then the
  // template's standard narrator.
  let requestedVoiceId: string | null = null;
  try {
    const body = (await req.json()) as { voiceId?: unknown } | null;
    if (typeof body?.voiceId === "string") requestedVoiceId = body.voiceId;
  } catch {
    // No body is the ordinary case: "read it again as it was".
  }

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
  // The film's own shape decides how many lines are expected: four when nobody
  // is announced, one per programme when several are listed, and none for a
  // field the user switched off. The film object is the one place that shape
  // is derived, so the count comes from it.
  const expected = eventCmFilm(brief).scenes.filter((scene) => scene.narrated).length;
  if (scenes.length !== expected) {
    // Says which state it is in. A partial script is the ordinary state while
    // somebody is writing, and 「先に台本を作成してください」 reads as though
    // nothing had been written at all.
    return Response.json(
      {
        error:
          scenes.length === 0
            ? "先に台本を作成してください"
            : `読み上げる言葉が無いコマがあります（${scenes.length}/${expected}コマ）。残りを書いてから読み上げてください`,
      },
      { status: 409 },
    );
  }

  const chosen =
    narrationVoiceById(requestedVoiceId) ??
    narrationVoiceByName(brief.voice?.track.voice) ??
    DEFAULT_NARRATION_VOICE;

  try {
    const { wav, track } = await generateNarration(scenes, {
      persona: EVENT_CM_PERSONA,
      voice: chosen.voice,
      // The same pause the pre-recording timeline assumes (timeline.ts).
      sceneGapMs: EVENT_CM_SCENE_GAP_MS,
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
      voiceId: chosen.id,
      voiceLabel: chosen.label,
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

/**
 * Turn the narration off.
 *
 * Only the brief's pointer is cleared. The WAV stays in R2 and stays pinned to
 * the take, because deleting the recording would make "off" an irreversible
 * act — and because the material list is where a person looks for what this
 * take is made of. Off means the film stops speaking: the timeline falls back
 * to estimating from the script, the captions come from the script's own text,
 * and the music plays at full level throughout. All three of those are
 * behaviours the composition already had for a take that had never been read
 * aloud (remotion/event-cm/timeline.ts), which is why this needs nothing else.
 */
export async function DELETE(
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
    return Response.json({ error: "このテンプレートには対応していません" }, { status: 400 });
  }

  const brief = { ...(take.brief as EventCmBrief) };
  if (!brief.voice) return Response.json({ ok: true, alreadyOff: true });
  delete brief.voice;

  const validated = validateBrief("event-cm", brief);
  if (!validated.ok) {
    return Response.json(
      { error: `ナレーションを外せません: ${validated.issues.join(", ")}` },
      { status: 400 },
    );
  }
  const saved = await supabase
    .from("takes")
    .update({ brief: validated.brief, updated_at: new Date().toISOString() })
    .eq("id", take.id);
  if (saved.error) {
    return Response.json({ error: saved.error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
