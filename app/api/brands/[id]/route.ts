import { guardLabsRequest } from "@/lib/labs-access";
import type {
  OrganizationDetail,
  OrganizationKind,
  OrganizationUpdate,
} from "@/lib/brand-detail";
import {
  parseBrandImport,
  saveBrandAssetsFromUrl,
} from "@/lib/brand/import-assets";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

const ORGANIZATION_KINDS = new Set<OrganizationKind>([
  "company",
  "individual",
  "nonprofit",
  "other",
]);

function text(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${name}が不正です`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${name}が長すぎます`);
  return normalized;
}

function website(value: unknown): string {
  const normalized = text(value, "WebサイトURL", 2048);
  if (!normalized) return "";
  const candidate = /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("WebサイトURLはhttp/httpsで入力してください");
  }
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  const entityResult = await supabase
    .from("brand_organizations")
    .select(
      "id, name, organization_kind, website, industry, location, description, status, updated_at, parent_organization_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (entityResult.error) {
    return Response.json(
      { error: "Organizationを取得できませんでした" },
      { status: 500 },
    );
  }
  if (!entityResult.data) {
    return Response.json(
      { error: "Organizationが見つかりません" },
      { status: 404 },
    );
  }

  const parentId = entityResult.data.parent_organization_id as string | null;
  const [parentResult, childrenResult, brandsResult] = await Promise.all([
    parentId
      ? supabase
          .from("brand_organizations")
          .select("id, name")
          .eq("id", parentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as {
          data: { id: string; name: string } | null;
          error: unknown;
        }),
    supabase
      .from("brand_organizations")
      .select("id, name, organization_kind")
      .eq("parent_organization_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("brand_entities")
      .select("id, name, brand_kind, status")
      .eq("brand_organization_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const relatedError =
    parentResult.error ?? childrenResult.error ?? brandsResult.error;
  if (relatedError) {
    return Response.json(
      { error: "関連するOrganization情報を取得できませんでした" },
      { status: 500 },
    );
  }

  const row = entityResult.data;
  const detail: OrganizationDetail = {
    id: row.id as string,
    name: row.name as string,
    organizationKind:
      (row.organization_kind as OrganizationKind | null) ?? null,
    website: (row.website as string) ?? "",
    industry: (row.industry as string) ?? "",
    location: (row.location as string) ?? "",
    description: (row.description as string) ?? "",
    status: row.status as OrganizationDetail["status"],
    updatedAt: row.updated_at as string,
    parentOrganization:
      parentResult.data && parentResult.data.id && parentResult.data.name
        ? {
            id: parentResult.data.id as string,
            name: parentResult.data.name as string,
          }
        : null,
    childOrganizations: ((childrenResult.data ?? []) as Array<{
      id: string;
      name: string;
      organization_kind: string | null;
    }>).map((child) => ({
      id: child.id,
      name: child.name,
      organizationKind:
        (child.organization_kind as OrganizationKind | null) ?? null,
    })),
    brands: ((brandsResult.data ?? []) as Array<{
      id: string;
      name: string;
      brand_kind: string;
      status: OrganizationDetail["status"];
    }>).map((brand) => ({
      id: brand.id,
      name: brand.name,
      brandKind: brand.brand_kind,
      status: brand.status as OrganizationDetail["status"],
    })),
  };
  return Response.json(
    { organization: detail },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  try {
    const body = (await req.json()) as Partial<OrganizationUpdate> & {
      updateMode?: "all" | "website_only";
      updateSource?: "manual" | "website_import";
      sourceUrl?: unknown;
      importedFields?: unknown;
      brandImport?: unknown;
    };
    const updateMode = body.updateMode ?? "all";

    const current = await supabase
      .from("brand_organizations")
      .select("provenance")
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw new Error("Organizationを確認できませんでした");
    if (!current.data) {
      return Response.json(
        { error: "Organizationが見つかりません" },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    if (updateMode === "website_only") {
      const normalizedWebsite = website(body.website);
      if (!normalizedWebsite) throw new Error("WebサイトURLを入力してください");
      const provenance = {
        ...((current.data.provenance as Record<string, unknown> | null) ?? {}),
        website: {
          source: "user_confirmed",
          confirmed_at: now,
          confirmed_by: user.id,
        },
      };
      const updated = await supabase
        .from("brand_organizations")
        .update({
          website: normalizedWebsite,
          provenance,
          updated_at: now,
        })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (updated.error) throw new Error("WebサイトURLを保存できませんでした");
      if (!updated.data)
        throw new Error("このOrganizationを編集する権限がありません");
      return Response.json(
        { ok: true, website: normalizedWebsite },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (updateMode !== "all") throw new Error("更新方法が不正です");

    const name = text(body.name, "Organization名", 160);
    if (!name) throw new Error("Organization名を入力してください");
    const organizationKind = body.organizationKind;
    if (!organizationKind || !ORGANIZATION_KINDS.has(organizationKind)) {
      throw new Error("Organization種別を選択してください");
    }

    const fields = [
      "name",
      "organization_kind",
      "website",
      "industry",
      "location",
      "description",
    ];
    const importedFromWebsite = body.updateSource === "website_import";
    const sourceUrl = importedFromWebsite ? website(body.sourceUrl) : "";
    if (importedFromWebsite && !sourceUrl) {
      throw new Error("情報源のWebサイトURLが不正です");
    }
    const importableFields: Record<string, string> = {
      name: "name",
      organizationKind: "organization_kind",
      industry: "industry",
      location: "location",
      website: "website",
      description: "description",
    };
    const importedFields = importedFromWebsite
      ? new Set(
          Array.isArray(body.importedFields)
            ? body.importedFields
                .filter(
                  (field): field is string =>
                    typeof field === "string" && field in importableFields,
                )
                .map((field) => importableFields[field])
            : [],
        )
      : new Set(fields);
    const importedBrand = importedFromWebsite
      ? parseBrandImport(body.brandImport)
      : null;
    if (importedFromWebsite && importedFields.size === 0 && !importedBrand) {
      throw new Error("上書きする情報を選択してください");
    }
    const provenance = {
      ...((current.data.provenance as Record<string, unknown> | null) ?? {}),
      ...Object.fromEntries(
        fields
          .filter((field) => importedFields.has(field))
          .map((field) => [
            field,
            importedFromWebsite
              ? {
                  source: "website_import",
                  source_url: sourceUrl,
                  imported_at: now,
                  confirmed_by: user.id,
                }
              : {
                  source: "user_confirmed",
                  confirmed_at: now,
                  confirmed_by: user.id,
                },
          ]),
      ),
    };
    const updated = await supabase
      .from("brand_organizations")
      .update({
        name,
        organization_kind: organizationKind,
        website: website(body.website),
        industry: text(body.industry, "業種", 160),
        location: text(body.location, "所在地", 240),
        description: text(body.description, "説明", 4000),
        status: "confirmed",
        source_kind: importedFromWebsite ? "scraped" : "manual",
        provenance,
        updated_at: now,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (updated.error) throw new Error("Organizationを保存できませんでした");
    if (!updated.data)
      throw new Error("このOrganizationを編集する権限がありません");

    const corporate = importedBrand
      ? await supabase
          .from("brand_entities")
          .select("id")
          .eq("brand_organization_id", id)
          .eq("brand_kind", "corporate")
          .eq("is_primary_brand", true)
          .limit(1)
          .maybeSingle()
      : null;
    if (corporate?.error || (importedBrand && !corporate?.data)) {
      throw new Error("企業ブランドを確認できませんでした");
    }
    if (importedBrand && corporate?.data) {
      await saveBrandAssetsFromUrl({
        supabase,
        userId: user.id,
        brandId: corporate.data.id as string,
        brandName: name,
        role: "corporate",
        sourceUrl,
        value: importedBrand,
      });
    }

    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "入力内容が不正です" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const supabase = createServerSupabaseForToken(user.token);

  try {
    const organization = await supabase
      .from("brand_organizations")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (organization.error)
      throw new Error("Organizationを確認できませんでした");
    if (!organization.data) {
      return Response.json(
        { error: "Organizationが見つかりません" },
        { status: 404 },
      );
    }

    const brandsResult = await supabase
      .from("brand_entities")
      .select("id, brand_kind, is_primary_brand")
      .eq("brand_organization_id", id);
    if (brandsResult.error) throw new Error("関連ブランドを確認できませんでした");
    const brands = brandsResult.data ?? [];
    const movableBrands = brands.filter(
      (brand) =>
        brand.brand_kind !== "corporate" || !brand.is_primary_brand,
    );
    if (movableBrands.length > 0) {
      return Response.json(
        { error: "ブランドをすべて移動してからOrganizationを削除してください" },
        { status: 409 },
      );
    }

    const brandIds = brands.map((brand) => brand.id as string);
    const [takesResult, logosResult] = await Promise.all([
      supabase
        .from("takes")
        .select("id")
        .in("brand_id", brandIds)
        .limit(1),
      supabase
        .from("logos")
        .select("id")
        .in("subject_entity_id", brandIds)
        .limit(1),
    ]);
    const relatedError = takesResult.error ?? logosResult.error;
    if (relatedError) throw new Error("関連データを確認できませんでした");
    if (
      (takesResult.data?.length ?? 0) > 0 ||
      (logosResult.data?.length ?? 0) > 0
    ) {
      return Response.json(
        { error: "Takeまたはロゴがあるため削除できません" },
        { status: 409 },
      );
    }

    if (brandIds.length > 0) {
      const deletedBrands = await supabase
        .from("brand_entities")
        .delete()
        .in("id", brandIds)
        .select("id");
      if (
        deletedBrands.error ||
        deletedBrands.data?.length !== brandIds.length
      ) {
        throw new Error("企業ブランドを削除できませんでした");
      }
    }

    const deleted = await supabase
      .from("brand_organizations")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (deleted.error || !deleted.data) {
      throw new Error("このOrganizationを削除する権限がありません");
    }

    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Organizationを削除できませんでした",
      },
      { status: 400 },
    );
  }
}
