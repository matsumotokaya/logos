// Master preview for one logo — a data URI resolved server-side.
//
// The asset detail page renders `logo.data.svg`, but a logo captured from a
// site is often a raster: the candidate row has `file_path` (an R2 object)
// and no svg. R2 is server-only, so the client cannot resolve that file
// itself; this endpoint reads the candidate the caller is allowed to see
// (RLS on logo_candidates decides) and hands back a displayable data URI.

import {
  LOGO_PREVIEW_COLUMNS,
  logoPreviewUrl,
  type LogoPreviewCandidate,
} from "@/lib/brand/logo-preview";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";

export type LogoMasterPreview = {
  previewUrl: string | null;
  /** True when the master is an inline SVG (vector). */
  isVector: boolean;
  mediaType: string | null;
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ logoId: string }> },
) {
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { logoId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data, error } = await supabase
    .from("logos")
    .select(`id, logo_candidates(${LOGO_PREVIEW_COLUMNS})`)
    .eq("id", logoId)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "ロゴを読み込めませんでした" }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "ロゴが見つかりません" }, { status: 404 });
  }

  const candidates = (data.logo_candidates ?? []) as LogoPreviewCandidate[];
  const primary = candidates.find((c) => c.is_primary) ?? candidates[0];
  const previewUrl = await logoPreviewUrl(candidates);
  const body: LogoMasterPreview = {
    previewUrl,
    isVector: Boolean(primary?.svg),
    mediaType: primary?.svg ? "image/svg+xml" : (primary?.media_type ?? null),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
