// Editing what a material IS, and how far it reaches.
//
// docs/asset-normalization.md §5 / §12 / §14-2 / §14-5. Two edits, one
// resource:
//
//   category  what the file depicts. Classification is decided FOR the user
//             rather than asked of them, and that is only defensible if the
//             correction sticks — so writing here sets category_source='user',
//             and lib/materials/classify.ts never overwrites that.
//
//   scope     how far the material reaches. Promotion to 'brand' is what makes
//             the base tier real: until now 1 of 47 rows was brand-scoped, so
//             「ブランドの基盤」 was a model with nothing in it.
//
// Scoped by brand rather than by take, because the material is the brand's and
// the same row appears in the inventory of every deliverable that pins it.
// Correcting it in one video corrects it everywhere, which is the point of
// putting the answer on the row.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { isMaterialCategory } from "@/lib/materials/category";
import {
  isMaterialScope,
  promotionRefusal,
  promotionTo,
} from "@/lib/materials/promotion";

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

  let body: { category?: unknown; scope?: unknown };
  try {
    body = (await req.json()) as { category?: unknown; scope?: unknown };
  } catch {
    return Response.json({ error: "内容を読めませんでした" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if ("category" in body) {
    // Clearing is allowed and means "not classified", which is a different
    // answer from `other` — the user may know that they do not know.
    if (body.category === null) {
      patch.category = null;
      patch.category_source = null;
    } else if (isMaterialCategory(body.category)) {
      patch.category = body.category;
      patch.category_source = "user";
    } else {
      return Response.json({ error: "その分類は使えません" }, { status: 400 });
    }
  }

  if ("scope" in body) {
    if (!isMaterialScope(body.scope)) {
      return Response.json({ error: "そのスコープは指定できません" }, { status: 400 });
    }
    patch.scope = body.scope;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "変更する内容がありません" }, { status: 400 });
  }

  // Read first, so a refusal can be told apart from a missing row. RLS makes an
  // update the caller may not perform return zero rows rather than an error,
  // and 「素材が見つかりません」 for a permission problem sends people looking
  // for the wrong thing.
  const current = await supabase
    .from("brand_materials")
    .select("id, scope, work_id")
    .eq("id", materialId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (current.error) {
    return Response.json({ error: "素材を確認できませんでした" }, { status: 500 });
  }
  if (!current.data) {
    return Response.json({ error: "素材が見つかりません" }, { status: 404 });
  }
  if (typeof patch.scope === "string") {
    // The screen is not the authority: it decided this was possible, and the
    // server counts again with the same function (lib/materials/promotion.ts).
    const decision = promotionTo(current.data, patch.scope);
    if (!decision.can) {
      return Response.json({ error: decision.reason }, { status: 409 });
    }
  }

  const updated = await supabase
    .from("brand_materials")
    .update(patch)
    .eq("id", materialId)
    .eq("brand_id", brandId)
    .select("id, category, category_source, scope")
    .maybeSingle();
  // Two different refusals reach here, and they look nothing alike from the
  // client:
  //
  //   USING fails      → zero rows, no error. The caller cannot edit this row.
  //   WITH CHECK fails → error 42501. The caller may edit it, but not into the
  //                      state they asked for — which is exactly what an
  //                      output-rung editor gets for scope='brand', since
  //                      brand_materials_update_output requires scope <> 'brand'
  //                      and only the core rung's policy would let it through.
  //
  // Both mean the same thing to the person: they are not allowed to do this.
  // The narrowing branch of the trigger also raises 42501, but promotionTo()
  // already refused that above, so a 42501 during a scope change is permission.
  if (updated.error || !updated.data) {
    return Response.json(
      {
        error:
          typeof patch.scope === "string"
            ? promotionRefusal(patch.scope)
            : "この素材を編集する権限がありません",
      },
      { status: 403 },
    );
  }

  return Response.json(
    { material: updated.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
