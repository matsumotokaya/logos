// The narration script of one video.
//
// POST writes a fresh draft from the take's own facts. PATCH stores an edit.
//
// The two differ in one field that decides everything downstream: `source`. A
// draft is `llm` and may be replaced by another draft; an edit is `human` and
// is never overwritten by a re-run unless the caller says so explicitly. That
// is what lets the golden path stay unattended — generate, speak, render, with
// nobody approving anything — while an edit still survives the next generation
// (the user's own framing: 直さなくても良い、直したければ直せる).

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { draftEventCmScript, eventCmScriptAvailable } from "@/lib/event-cm/script";
import { applySuppression } from "@/lib/event-cm/facts";
import { validateBrief } from "@/lib/templates/brief-schemas";
import {
  eventCmNarratedSteps,
  eventCmSceneKey,
  type EventCmBrief,
} from "@/remotion/event-cm/types";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

async function loadTake(
  supabase: ReturnType<typeof createServerSupabaseForToken>,
  brandId: string,
  videoId: string,
) {
  const { data, error } = await supabase
    .from("takes")
    .select("id, template_id, brief")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();
  if (error) return { error: "動画を確認できませんでした", status: 500 } as const;
  if (!data) return { error: "動画が見つかりません", status: 404 } as const;
  if (data.template_id !== "event-cm") {
    return { error: "このテンプレートは台本を持ちません", status: 400 } as const;
  }
  return { take: data } as const;
}

/** Write a brief back, validated against the template it is pinned to. */
async function saveBrief(
  supabase: ReturnType<typeof createServerSupabaseForToken>,
  takeId: string,
  brief: EventCmBrief,
) {
  const validated = validateBrief("event-cm", brief);
  if (!validated.ok) {
    return { error: `台本が不正です: ${validated.issues.join(", ")}`, status: 400 } as const;
  }
  const { error } = await supabase
    .from("takes")
    .update({ brief: validated.brief, updated_at: new Date().toISOString() })
    .eq("id", takeId);
  if (error) return { error: error.message, status: 500 } as const;
  return { ok: true } as const;
}

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

  const loaded = await loadTake(supabase, brandId, videoId);
  if ("error" in loaded) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }
  if (!eventCmScriptAvailable()) {
    return Response.json({ error: "台本の生成が設定されていません" }, { status: 503 });
  }

  const brief = loaded.take.brief as EventCmBrief;
  const body = (await req.json().catch(() => ({}))) as { force?: unknown };
  if (brief.script?.source === "human" && body.force !== true) {
    return Response.json(
      { error: "編集済みの台本があります。上書きするには force を指定してください" },
      { status: 409 },
    );
  }

  let draft;
  try {
    // Written against the brief AS THE FILM SEES IT. A field switched off is not
    // on screen, so it must not be spoken either — and, more mechanically, the
    // shape of the script has to match the shape of the film: with the speakers
    // switched off there is no speaker picture, and a line written for one would
    // have nowhere to go.
    draft = await draftEventCmScript(applySuppression(brief), {
      now: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "台本を生成できませんでした" },
      { status: 502 },
    );
  }

  // Writing the script makes any existing voice describe words nobody says any
  // more. Dropping it is what keeps the film honest: the timeline falls back
  // to the script's own length until the voice is made again.
  const next: EventCmBrief = { ...brief, script: draft.script };
  delete next.voice;

  const saved = await saveBrief(supabase, loaded.take.id as string, next);
  if ("error" in saved) {
    return Response.json({ error: saved.error }, { status: saved.status });
  }
  return Response.json({ script: draft.script });
}

export async function PATCH(
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

  const loaded = await loadTake(supabase, brandId, videoId);
  if ("error" in loaded) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }

  let body: { scenes?: unknown; angle?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "リクエストを解釈できませんでした" }, { status: 400 });
  }
  if (!Array.isArray(body.scenes)) {
    return Response.json({ error: "台本のシーンが必要です" }, { status: 400 });
  }

  // Keyed by scene identity: a caller editing the second programme's line sends
  // `{ role: "program", index: 1 }`, and keying by role alone would have written
  // that text over all three programme pictures.
  const texts = new Map<string, string>();
  for (const raw of body.scenes) {
    if (!raw || typeof raw !== "object") continue;
    const scene = raw as { role?: unknown; index?: unknown; text?: unknown };
    if (typeof scene.role === "string" && typeof scene.text === "string") {
      const key =
        typeof scene.index === "number"
          ? `${scene.role}#${scene.index}`
          : scene.role;
      texts.set(key, scene.text.trim());
    }
  }
  const brief = loaded.take.brief as EventCmBrief;
  // The script holds the narrated PICTURES of this brief — four with nobody
  // announced, one per programme when several are listed — not all seven scenes.
  // Walking every role and reading the previous text by array index did both
  // wrong: it demanded words for the two silent mark scenes, and it lined line 1
  // up against scene 0. So the shape comes from the brief and previous text is
  // looked up by scene identity, which is also what lets a caller send one line
  // and keep the rest.
  // The film's shape, not the brief's raw contents: a suppressed field has no
  // picture. The brief itself is saved unsuppressed — switching a field off is a
  // decision to hide it, never to delete it.
  const steps = eventCmNarratedSteps(applySuppression(brief));
  const previous = new Map(
    (brief.script?.scenes ?? []).map(
      (scene) => [eventCmSceneKey(scene), scene.text] as const,
    ),
  );
  // A partial script is a legal, ordinary state — not an error.
  //
  // This used to demand a line for every narrated picture, which made saving ONE
  // line impossible the moment the film gained a picture nobody had written yet:
  // splitting three programmes into three pictures left two of them blank, so
  // every single-line save was refused with 「空のコマがあります」. Everything
  // downstream already handles a missing line: the timeline falls back to that
  // scene's budget, the captions skip it, and `scriptIsStale` reports that the
  // narration is not finished. So lines with no words are simply not stored, and
  // the order of the ones that are is the film's order.
  const scenes = steps
    .map((step) => {
      const key = eventCmSceneKey(step);
      return {
        role: step.role,
        ...(step.index === undefined ? {} : { index: step.index }),
        text: texts.get(key) ?? previous.get(key) ?? "",
      };
    })
    .filter((scene) => scene.text.length > 0);
  if (scenes.length === 0) {
    return Response.json(
      { error: "読み上げる言葉がありません" },
      { status: 400 },
    );
  }

  const next: EventCmBrief = {
    ...brief,
    script: {
      version: 1,
      scenes,
      // The edit is the point of the record: a later draft will refuse to
      // overwrite this without being told to.
      source: "human",
      updatedAt: new Date().toISOString(),
      angle:
        typeof body.angle === "string" ? body.angle.trim() : (brief.script?.angle ?? ""),
    },
  };
  delete next.voice;

  const saved = await saveBrief(supabase, loaded.take.id as string, next);
  if ("error" in saved) {
    return Response.json({ error: saved.error }, { status: saved.status });
  }
  return Response.json({ script: next.script });
}
