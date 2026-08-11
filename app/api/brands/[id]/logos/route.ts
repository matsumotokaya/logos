// Logos owned by the brand_entity's organization — the brand's library, viewed
// from a single brand. Logos are recorded with subject_entity_id pointing at
// the brand_entity that owns them, so the list reads "logos whose subject
// sits under the same brand_organization as this brand".

import { guardLabsRequest } from "@/lib/labs-access";
import { createServerSupabaseForToken, requireUser } from "@/lib/supabase/server";

export type LogoSummary = {
  id: string;
  title: string;
  role: string;
  visibility: string;
  /** The brand entity this logo is filed under. */
  subjectEntityId: string;
  subjectEntityName: string;
  previewUrl: string | null;
};

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  let user;
  try {
    user = await requireUser(req);
  } catch {
    return unauthorized();
  }
  const { id: brandId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const { data: brand, error: brandError } = await supabase
    .from("brand_entities")
    .select("id, name, brand_organization_id")
    .eq("id", brandId)
    .maybeSingle();
  if (brandError) {
    return Response.json({ error: "ブランドを確認できませんでした" }, { status: 500 });
  }
  if (!brand) {
    return Response.json({ error: "ブランドが見つかりません" }, { status: 404 });
  }

  // All brand entities under the same organization as this brand are part of
  // the same library — the user navigated here from one of them, but the logo
  // list does not change shape between WealthPark Lab and WealthPark.
  const { data: siblings, error: siblingsError } = await supabase
    .from("brand_entities")
    .select("id, name")
    .eq("brand_organization_id", brand.brand_organization_id);
  if (siblingsError) {
    return Response.json({ error: "ライブラリを読み込めませんでした" }, { status: 500 });
  }
  const subjectIds = (siblings ?? []).map((s) => s.id);
  const subjectNames = new Map(
    (siblings ?? []).map((s) => [s.id as string, s.name as string]),
  );

  const { data: logos, error: logosError } = await supabase
    .from("logos")
    .select(
      "id, title, role, visibility, subject_entity_id, logo_candidates(id, is_primary, svg, media_type, file_path)",
    )
    .in("subject_entity_id", subjectIds)
    .order("created_at", { ascending: true });
  if (logosError) {
    return Response.json({ error: "ロゴを取得できませんでした" }, { status: 500 });
  }

  const summaries: LogoSummary[] = await Promise.all(
    (logos ?? []).map(async (row) => {
      const candidates = (row.logo_candidates ?? []) as Array<{
        id: string;
        is_primary: boolean;
        svg: string | null;
        media_type: string;
        file_path: string | null;
      }>;
      const primary = candidates.find((c) => c.is_primary) ?? candidates[0];
      let previewUrl: string | null = null;
      if (primary) {
        if (primary.svg) {
          previewUrl = `data:image/svg+xml;base64,${Buffer.from(primary.svg, "utf8").toString("base64")}`;
        } else if (primary.file_path && primary.media_type.startsWith("image/")) {
          previewUrl = await logoPreviewSignedUrl(supabase, primary.file_path);
        }
      }
      return {
        id: row.id as string,
        title: row.title as string,
        role: row.role as string,
        visibility: row.visibility as string,
        subjectEntityId: row.subject_entity_id as string,
        subjectEntityName: subjectNames.get(row.subject_entity_id as string) ?? "",
        previewUrl,
      };
    }),
  );

  return Response.json({
    brand: { id: brand.id, name: brand.name },
    logos: summaries,
  });
}

async function logoPreviewSignedUrl(
  supabase: ReturnType<typeof createServerSupabaseForToken>,
  filePath: string,
): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("logos").createSignedUrl(filePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}