// Brand overview — the data behind /brands/[id] (the brand top). Reads the
// brand_entity itself plus the adopted brand-knowledge facts, so the page can
// show "this brand's profile" (palette, fonts, voice rules) before it lists
// the assets (logos / videos / LPs).

import { guardLabsRequest } from "@/lib/labs-access";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

export type KnowledgeValue = {
  fieldPath: string;
  value: unknown;
  confidence: string;
  decidedAt: string;
};

export type BrandOverview = {
  id: string;
  name: string;
  brandKind: string;
  /** The Organization this brand sits under. Re-importing the brand's look
   *  goes through the business PATCH, which requires it. */
  brandOrganizationId: string;
  website: string;
  industry: string;
  location: string;
  description: string;
  updatedAt: string;
  knowledge: KnowledgeValue[];
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

  const [entityResult, knowledgeResult] = await Promise.all([
    supabase
      .from("brand_entities")
      .select(
        "id, name, brand_kind, brand_organization_id, website, industry, location, description, updated_at",
      )
      .eq("id", brandId)
      .maybeSingle(),
    supabase
      .from("brand_knowledge_values")
      .select("field_path, value, confidence, decided_at")
      .eq("brand_id", brandId)
      .is("variant_id", null)
      .order("field_path"),
  ]);

  if (entityResult.error) {
    return Response.json(
      { error: "ブランドを取得できませんでした" },
      { status: 500 },
    );
  }
  if (!entityResult.data) {
    return Response.json({ error: "ブランドが見つかりません" }, { status: 404 });
  }
  if (knowledgeResult.error) {
    return Response.json(
      { error: "ブランドアセットを取得できませんでした" },
      { status: 500 },
    );
  }

  const row = entityResult.data;
  const overview: BrandOverview = {
    id: row.id as string,
    name: row.name as string,
    brandKind: (row.brand_kind as string) ?? "",
    brandOrganizationId: (row.brand_organization_id as string) ?? "",
    website: (row.website as string) ?? "",
    industry: (row.industry as string) ?? "",
    location: (row.location as string) ?? "",
    description: (row.description as string) ?? "",
    updatedAt: row.updated_at as string,
    knowledge: (knowledgeResult.data ?? []).map((k) => ({
      fieldPath: k.field_path as string,
      value: k.value,
      confidence: k.confidence as string,
      decidedAt: k.decided_at as string,
    })),
  };
  return Response.json(
    { overview },
    { headers: { "Cache-Control": "no-store" } },
  );
}