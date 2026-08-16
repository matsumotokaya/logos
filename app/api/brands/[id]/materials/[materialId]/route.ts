// Correcting what a file is.
//
// docs/asset-normalization.md §5 / §14-2. Classification is decided for the
// user rather than asked of them, and that is only defensible if the
// correction sticks — so this is the other half of the contract the run side
// already keeps: writing here sets category_source='user', and
// lib/materials/classify.ts never overwrites that.
//
// Scoped by brand rather than by take, because the material is the brand's and
// the same row shows in the inventory of every deliverable that pins it.
// Correcting it in one video corrects it everywhere, which is the point of
// putting the answer on the row.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { isMaterialCategory } from "@/lib/materials/category";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; materialId: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId, materialId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  let body: { category?: unknown };
  try {
    body = (await req.json()) as { category?: unknown };
  } catch {
    return Response.json({ error: "内容を読めませんでした" }, { status: 400 });
  }

  // Clearing is allowed and means "not classified", which is a different
  // answer from `other` — the user may know that they do not know.
  const clearing = body.category === null;
  if (!clearing && !isMaterialCategory(body.category)) {
    return Response.json({ error: "その分類は使えません" }, { status: 400 });
  }

  const updated = await supabase
    .from("brand_materials")
    .update(
      clearing
        ? { category: null, category_source: null }
        : { category: body.category as string, category_source: "user" },
    )
    .eq("id", materialId)
    .eq("brand_id", brandId)
    .select("id, category, category_source")
    .maybeSingle();
  if (updated.error) {
    return Response.json({ error: "分類を保存できませんでした" }, { status: 500 });
  }
  if (!updated.data) {
    return Response.json({ error: "素材が見つかりません" }, { status: 404 });
  }

  return Response.json(
    { material: updated.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
