import { guardLabsRequest } from "@/lib/labs-access";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

function businessId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value.trim())) {
    throw new Error("取り込むブランドを選択してください");
  }
  return value.trim();
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id: organizationId } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  try {
    const body = (await req.json()) as { businessId?: unknown };
    const selectedBusinessId = businessId(body.businessId);
    const [organizationResult, businessResult] = await Promise.all([
      supabase
        .from("brand_organizations")
        .select("id, name, linked_org_id")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("brand_entities")
        .select(
          "id, name, website, status, brand_organization_id, brand_kind, provenance",
        )
        .eq("id", selectedBusinessId)
        .eq("brand_kind", "business")
        .maybeSingle(),
    ]);
    if (organizationResult.error || !organizationResult.data) {
      throw new Error("取り込み先Organizationを確認できませんでした");
    }
    if (businessResult.error || !businessResult.data) {
      throw new Error("取り込むブランドを確認できませんでした");
    }
    if (businessResult.data.brand_organization_id === organizationId) {
      throw new Error("このブランドはすでにOrganizationに所属しています");
    }

    const corporateResult = await supabase
      .from("brand_entities")
      .select("id")
      .eq("brand_organization_id", organizationId)
      .eq("brand_kind", "corporate")
      .eq("is_primary_brand", true)
      .limit(1)
      .maybeSingle();
    if (corporateResult.error || !corporateResult.data) {
      throw new Error("取り込み先の企業ブランドを確認できませんでした");
    }

    const now = new Date().toISOString();
    const provenance = {
      ...((businessResult.data.provenance as Record<string, unknown> | null) ??
        {}),
      brand_organization_id: {
        source: "user_reparented",
        confirmed_at: now,
        confirmed_by: user.id,
      },
    };
    const updated = await supabase
      .from("brand_entities")
      .update({
        brand_organization_id: organizationId,
        parent_brand_id: corporateResult.data.id,
        linked_org_id: organizationResult.data.linked_org_id,
        status: "confirmed",
        provenance,
        updated_at: now,
      })
      .eq("id", selectedBusinessId)
      .eq("brand_kind", "business")
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new Error("このブランドをOrganizationへ取り込む権限がありません");
    }

    return Response.json(
      {
        ok: true,
        business: {
          id: businessResult.data.id,
          name: businessResult.data.name,
          website: businessResult.data.website ?? "",
          status: "confirmed",
        },
        previousOrganizationId: businessResult.data.brand_organization_id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ブランドを取り込めませんでした",
      },
      { status: 400 },
    );
  }
}
