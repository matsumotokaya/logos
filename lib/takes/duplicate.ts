import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTake } from "@/lib/takes/create";
import { duplicateTitle } from "@/lib/takes/naming";

// Duplicating a take — a second version of a video or an LP.
//
// A take is the editable thing, so "make a variant of this" means a new take
// carrying the same brief and the same pinned inputs. Nothing is copied in R2:
// the copy pins the *same* material rows, at the same checksums, which is what
// makes duplication cheap and what makes the two versions agree about their
// footage until someone changes one of them.
//
// Two consequences worth being explicit about:
//
//   - The copy pins materials still scoped to the source take (a generated
//     narration WAV, an upload made on that screen). Deleting the source then
//     asks what to do with them, and `promote` is what keeps the copy playable —
//     that question exists in `delete_take` precisely because of this.
//   - The copy is pinned to the template's *current* production version, not the
//     source's. A take may not be created against a retired version, and a brief
//     the current schema rejects is reported rather than silently reshaped.
//
// Renders are not copied. `createTake` makes the template's default render rows
// empty, so the copy starts as "not rendered yet" — carrying over the source's
// MP4 would claim these bytes came from this brief, and they did not.

export type DuplicateTakeOutcome =
  | { ok: true; takeId: string; title: string; inputsCopied: number }
  | { ok: false; status: number; error: string; issues?: string[] };

export async function duplicateTake(
  supabase: SupabaseClient,
  input: {
    brandId: string;
    takeId: string;
    toolKind: "video" | "lp";
    createdBy: string;
    /** Overrides the generated 「…のコピー」 name. */
    title?: string | null;
  },
): Promise<DuplicateTakeOutcome> {
  const { data: source, error: sourceError } = await supabase
    .from("takes")
    .select("id, brand_id, tool_kind, template_id, title, brief, work_id, variant_id")
    .eq("id", input.takeId)
    .eq("brand_id", input.brandId)
    .eq("tool_kind", input.toolKind)
    .maybeSingle();
  if (sourceError) {
    return { ok: false, status: 500, error: "複製元を取得できませんでした" };
  }
  if (!source) {
    return { ok: false, status: 404, error: "複製元が見つかりません" };
  }

  const { data: siblings, error: siblingsError } = await supabase
    .from("takes")
    .select("title")
    .eq("brand_id", input.brandId)
    .eq("tool_kind", input.toolKind);
  if (siblingsError) {
    return { ok: false, status: 500, error: "既存の名前を確認できませんでした" };
  }

  const title =
    input.title?.trim() ||
    duplicateTitle(
      (source.title as string | null) ?? "",
      (siblings ?? []).map((row) => (row.title as string | null) ?? ""),
    );

  const created = await createTake(supabase, {
    brandId: input.brandId,
    templateId: source.template_id as string,
    title,
    brief: source.brief,
    workId: (source.work_id as string | null) ?? null,
    variantId: (source.variant_id as string | null) ?? null,
    createdBy: input.createdBy,
  });
  if (!created.ok) {
    return { ok: false, status: 500, error: created.error, issues: created.issues };
  }

  const { data: pins, error: pinsError } = await supabase
    .from("take_inputs")
    .select("role, material_id, checksum")
    .eq("take_id", input.takeId);
  if (pinsError) {
    // The take exists and its brief is complete; only the input pins are
    // missing. Saying so beats deleting the copy the user is now looking at.
    return {
      ok: false,
      status: 500,
      error: "複製は作成しましたが、素材の固定を引き継げませんでした",
    };
  }

  const rows = (pins ?? []).map((pin) => ({
    take_id: created.takeId,
    role: pin.role as string,
    material_id: pin.material_id as string,
    checksum: pin.checksum as string | null,
  }));
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("take_inputs").insert(rows);
    if (insertError) {
      return {
        ok: false,
        status: 500,
        error: `複製は作成しましたが、素材を固定できませんでした: ${insertError.message}`,
      };
    }
  }

  return { ok: true, takeId: created.takeId, title, inputsCopied: rows.length };
}
