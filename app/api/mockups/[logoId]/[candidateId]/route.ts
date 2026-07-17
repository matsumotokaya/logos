import { mockupObjectKey, MOCKUP_SLOT_RE } from "@/lib/mockups";
import { deleteR2Object } from "@/lib/r2";
import {
  createServerSupabaseForToken,
  requireAccessToken,
} from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ logoId: string; candidateId: string }> },
) {
  try {
    const token = await requireAccessToken(req);
    const { logoId, candidateId } = await params;
    const supabase = createServerSupabaseForToken(token);

    const { data, error } = await supabase
      .from("logo_mockups")
      .select("slot")
      .eq("candidate_id", candidateId);
    if (error) throw error;

    const mockups = Object.fromEntries(
      (data ?? [])
        .filter((row) => MOCKUP_SLOT_RE.test(row.slot))
        .map((row) => [
          row.slot,
          `/api/mockups/${logoId}/${candidateId}/${row.slot}`,
        ]),
    );
    return Response.json(mockups, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load mockups.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ logoId: string; candidateId: string }> },
) {
  try {
    const token = await requireAccessToken(req);
    const { logoId, candidateId } = await params;
    const supabase = createServerSupabaseForToken(token);

    // Delete DB rows first: mockups_write RLS authorizes the caller, and only
    // the rows it actually deleted get their R2 objects removed. Reversed
    // order would let a non-editor destroy storage for rows RLS then refuses
    // to delete.
    const { data: deleted, error: deleteError } = await supabase
      .from("logo_mockups")
      .delete()
      .eq("candidate_id", candidateId)
      .select("slot, image_path");
    if (deleteError) throw deleteError;

    for (const row of deleted ?? []) {
      const key = row.image_path || mockupObjectKey(logoId, candidateId, row.slot);
      await deleteR2Object(key);
    }

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete mockups.";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}

