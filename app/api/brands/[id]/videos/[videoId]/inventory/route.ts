// The material inventory of one video, in two tiers.
//
// docs/asset-normalization.md §9.1. The screen shows what this deliverable is
// made of AND what the brand already had, because that is the shape the
// injection actually has (§7): a base that every deliverable starts from, and
// the material this one added on top.
//
// Two tiers, one query each, and the tier a row is in is its scope — there is
// no separate notion of "base" to keep in sync. `take`/`work` rows are this
// video's; `brand` rows are the base. The widen-only trigger from 0028 means a
// row moves between tiers by being promoted, never by being copied.

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";
import { eventCmUsageRecord, type MaterialUse } from "@/lib/event-cm/material-usage";
import { MATERIAL_NAMING_COLUMNS } from "@/lib/materials/naming";
import type { EventCmBrief } from "@/remotion/event-cm/types";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

/** One row of the inventory, as the screen needs it. */
export interface InventoryMaterial {
  id: string;
  label: string;
  kind: string;
  /** What it depicts (0053). Null = not classified yet, which is not "other". */
  category: string | null;
  /** 'inferred' (a run may replace it) or 'user' (a run may not). */
  category_source: string | null;
  media_type: string | null;
  bytes: number | null;
  scope: string;
  source_kind: string;
  /** Measured at intake (0052). Null = never measured. */
  width: number | null;
  height: number | null;
  opaque: boolean | null;
  luminance: number | null;
  /** Where the artwork sits inside the frame (0055). Null = never measured. */
  ink_ratio: number | null;
  trim_width: number | null;
  trim_height: number | null;
  /** Set on a normalised copy: the material it was cut from (§11). */
  derived_from_material_id: string | null;
  created_at: string;
}

export interface InventoryPayload {
  /** scope take/work: what this video added. */
  own: InventoryMaterial[];
  /** scope brand: the base the brand already had. */
  base: InventoryMaterial[];
  /** materialId → where the film uses it. Absent = pinned but not on screen. */
  usage: Record<string, MaterialUse[]>;
}

// Naming owns its own column list, so a name never loses a word because a
// query forgot a measurement (it already did once: without `luminance` every
// mark dropped its dark/light).
const COLUMNS =
  `id, ${MATERIAL_NAMING_COLUMNS}, category_source, bytes, scope, height, ` +
  // The geometry the normalisation offer is decided from, and the pointer that
  // says the offer was already taken. Both have to be here or the screen asks a
  // question it has already been answered (docs/asset-normalization.md §11).
  `ink_ratio, trim_width, trim_height, derived_from_material_id, created_at`;

export async function GET(
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

  const take = await supabase
    .from("takes")
    .select("id, work_id, template_id, brief")
    .eq("id", videoId)
    .eq("brand_id", brandId)
    .eq("tool_kind", "video")
    .maybeSingle();
  if (take.error) {
    return Response.json({ error: "動画を確認できませんでした" }, { status: 500 });
  }
  if (!take.data) {
    return Response.json({ error: "動画が見つかりません" }, { status: 404 });
  }

  // This video's own material: pinned to the take, plus anything shared at the
  // work it belongs to — an event's photographs are used by every film of that
  // event, so they belong in the same tier rather than looking like the brand's.
  const ownQuery = supabase
    .from("brand_materials")
    .select(COLUMNS)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  const [own, base] = await Promise.all([
    take.data.work_id
      ? ownQuery.or(`take_id.eq.${take.data.id},work_id.eq.${take.data.work_id}`)
      : ownQuery.eq("take_id", take.data.id),
    supabase
      .from("brand_materials")
      .select(COLUMNS)
      .eq("brand_id", brandId)
      .eq("scope", "brand")
      .order("created_at", { ascending: true }),
  ]);
  if (own.error || base.error) {
    return Response.json({ error: "素材を取得できませんでした" }, { status: 500 });
  }

  // Only event-cm can name its own slots today. Another template returns an
  // empty map rather than a wrong one: "we do not know where this is used"
  // shows as no usage, which is honest, and inventing a label would not be.
  const usage =
    take.data.template_id === "event-cm"
      ? eventCmUsageRecord(take.data.brief as EventCmBrief)
      : {};

  const payload: InventoryPayload = {
    own: (own.data ?? []) as unknown as InventoryMaterial[],
    base: (base.data ?? []) as unknown as InventoryMaterial[],
    usage,
  };
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
