// One fact of one video.
//
// The list under the preview is the input surface, so this is what it writes
// to. Three operations and no others: replace a value, switch a field off,
// switch it back on.
//
// Editing records `user` as the origin, which is what stops a later re-run
// from putting the guess back. Switching off records a decision rather than a
// gap, so the field stops being counted as something still to collect.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { validateBrief } from "@/lib/templates/brief-schemas";
import {
  applyFactEdit,
  isEditable,
  markUserEdited,
  setSuppressed,
} from "@/lib/event-cm/facts";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

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

  let body: { path?: unknown; lines?: unknown; suppressed?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "リクエストを解釈できませんでした" }, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path : "";
  if (!path) return Response.json({ error: "項目が必要です" }, { status: 400 });

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

  let next = take.brief as EventCmBrief;

  if (typeof body.suppressed === "boolean") {
    next = setSuppressed(next, path, body.suppressed);
  } else if (Array.isArray(body.lines)) {
    if (!isEditable(path)) {
      return Response.json(
        { error: "この項目はここでは編集できません" },
        { status: 400 },
      );
    }
    const lines = body.lines.filter((line): line is string => typeof line === "string");
    const edited = applyFactEdit(next, path, lines);
    if (!edited) {
      return Response.json({ error: "この項目は編集できません" }, { status: 400 });
    }
    next = markUserEdited(edited, path);
  } else {
    return Response.json({ error: "値または表示の指定が必要です" }, { status: 400 });
  }

  const validated = validateBrief("event-cm", next);
  if (!validated.ok) {
    return Response.json(
      { error: `内容が不正です: ${validated.issues.join(", ")}` },
      { status: 400 },
    );
  }
  const { error: saveError } = await supabase
    .from("takes")
    .update({ brief: validated.brief, updated_at: new Date().toISOString() })
    .eq("id", take.id);
  if (saveError) {
    return Response.json({ error: saveError.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
