import { guardLabsRequest } from "@/lib/labs-access";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";
import { deleteR2Object } from "@/lib/r2";

/**
 * Remove a brand-scope material. The R2 object goes only when no other row
 * points at it: keys are content-addressed, so the same bytes uploaded to two
 * brands share one object and deleting one must not blank the other.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; materialId: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id, materialId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const target = await supabase
    .from("brand_materials")
    .select("id, r2_key")
    .eq("id", materialId)
    .eq("brand_id", id)
    .eq("scope", "brand")
    .maybeSingle();
  if (target.error) {
    return Response.json({ error: "素材を確認できませんでした" }, { status: 500 });
  }
  if (!target.data) {
    return Response.json({ error: "素材が見つかりません" }, { status: 404 });
  }

  // A material pinned as a Take's input cannot go: that Take's output would
  // stop being reproducible from its recorded inputs.
  const pinned = await supabase
    .from("take_inputs")
    .select("take_id")
    .eq("material_id", materialId)
    .limit(1);
  if (pinned.error) {
    return Response.json({ error: "素材の利用状況を確認できませんでした" }, { status: 500 });
  }
  if ((pinned.data ?? []).length > 0) {
    return Response.json(
      { error: "この素材は成果物の入力として固定されているため削除できません" },
      { status: 409 },
    );
  }

  const removed = await supabase
    .from("brand_materials")
    .delete()
    .eq("id", materialId)
    .eq("brand_id", id)
    .eq("scope", "brand")
    .select("id")
    .maybeSingle();
  if (removed.error || !removed.data) {
    return Response.json({ error: "素材を削除できませんでした" }, { status: 403 });
  }

  const key = target.data.r2_key as string | null;
  if (key) {
    const others = await supabase
      .from("brand_materials")
      .select("id")
      .eq("r2_key", key)
      .limit(1);
    if (!others.error && (others.data ?? []).length === 0) {
      await deleteR2Object(key).catch(() => undefined);
    }
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
