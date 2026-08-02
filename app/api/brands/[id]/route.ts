import { randomUUID } from "node:crypto";
import { guardLabsRequest } from "@/lib/labs-access";
import type {
  BrandUrlInspection,
  OrganizationDetail,
  OrganizationKind,
  OrganizationUpdate,
} from "@/lib/brand-detail";
import { newLogoId } from "@/lib/id";
import {
  deleteR2Object,
  getR2Object,
  isR2Configured,
  putR2Object,
} from "@/lib/r2";
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

type BrandImport = NonNullable<BrandUrlInspection["brandAssets"]>;

type OrganizationLogoRow = {
  id: string;
  title: string;
  role: string;
  visibility: string;
  logo_candidates: Array<{
    id: string;
    is_primary: boolean;
    svg: string | null;
    media_type: string;
    file_path: string | null;
  }>;
};

async function organizationLogoSummary(
  row: OrganizationLogoRow,
): Promise<OrganizationDetail["logos"][number]> {
  const candidate =
    row.logo_candidates.find((item) => item.is_primary) ??
    row.logo_candidates[0];
  let previewUrl: string | null = null;
  if (candidate?.svg) {
    previewUrl = `data:image/svg+xml;base64,${Buffer.from(candidate.svg, "utf8").toString("base64")}`;
  } else if (candidate?.file_path) {
    const file = await getR2Object(candidate.file_path);
    if (file) {
      previewUrl = `data:${candidate.media_type || "image/png"};base64,${file.toString("base64")}`;
    }
  }
  return {
    id: row.id,
    title: row.title,
    role: row.role,
    visibility: row.visibility,
    previewUrl,
  };
}

function brandImport(value: unknown): BrandImport | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BrandImport>;
  const rawPalette = candidate.palette;
  const palette =
    rawPalette && typeof rawPalette === "object"
      ? Object.fromEntries(
          Object.entries(rawPalette)
            .filter(
              ([key, color]) =>
                key.length <= 40 &&
                typeof color === "string" &&
                /^#[0-9a-f]{6}$/i.test(color),
            )
            .slice(0, 8),
        )
      : {};
  const tokenKeys = [
    "body_font",
    "heading_font",
    "button_radius",
    "button_padding",
    "section_spacing",
    "container_width",
  ] as const;
  const rawTokens = candidate.designTokens;
  const designTokens = rawTokens
    ? (Object.fromEntries(
        tokenKeys.map((key) => {
          const token = rawTokens[key];
          return [
            key,
            typeof token === "string" ? token.trim().slice(0, 240) : null,
          ];
        }),
      ) as BrandImport["designTokens"])
    : null;
  const rawLogo = candidate.logo;
  const logo =
    rawLogo?.mediaType === "image/png" &&
    typeof rawLogo.data === "string" &&
    rawLogo.data.length > 0 &&
    rawLogo.data.length <= 2_000_000 &&
    typeof rawLogo.sourceUrl === "string"
      ? {
          data: rawLogo.data,
          mediaType: "image/png" as const,
          sourceUrl: website(rawLogo.sourceUrl),
        }
      : null;
  if (Object.keys(palette).length === 0 && !designTokens && !logo) return null;
  return { palette, designTokens, logo };
}

async function saveOrganizationBrandAssets({
  supabase,
  userId,
  corporateBrandId,
  organizationName,
  sourceUrl,
  value,
}: {
  supabase: ReturnType<typeof createServerSupabaseForToken>;
  userId: string;
  corporateBrandId: string;
  organizationName: string;
  sourceUrl: string;
  value: BrandImport;
}): Promise<{
  profile: OrganizationDetail["profile"];
  logo: OrganizationDetail["logos"][number] | null;
}> {
  const now = new Date().toISOString();
  const currentProfile = await supabase
    .from("brand_profiles")
    .select("profile, provenance, created_by")
    .eq("entity_id", corporateBrandId)
    .maybeSingle();
  if (currentProfile.error)
    throw new Error("ブランドプロフィールを確認できませんでした");
  const profileValue = {
    ...((currentProfile.data?.profile as Record<string, unknown> | null) ?? {}),
    ...(Object.keys(value.palette).length > 0
      ? { palette: value.palette }
      : {}),
    ...(value.designTokens ? { design_tokens: value.designTokens } : {}),
  };
  const profileProvenance = {
    ...((currentProfile.data?.provenance as Record<string, unknown> | null) ??
      {}),
    ...(Object.keys(value.palette).length > 0
      ? {
          palette: {
            source: "site_capture",
            source_url: sourceUrl,
            confirmed_by: userId,
          },
        }
      : {}),
    ...(value.designTokens
      ? {
          design_tokens: {
            source: "site_capture",
            source_url: sourceUrl,
            confirmed_by: userId,
          },
        }
      : {}),
  };
  const savedProfile = await supabase.from("brand_profiles").upsert(
    {
      entity_id: corporateBrandId,
      inherits_parent: false,
      status: "confirmed",
      profile: profileValue,
      provenance: profileProvenance,
      created_by: currentProfile.data?.created_by ?? userId,
      updated_at: now,
    },
    { onConflict: "entity_id" },
  );
  if (savedProfile.error)
    throw new Error("ブランドプロフィールを保存できませんでした");

  let createdLogo: OrganizationDetail["logos"][number] | null = null;
  if (value.logo) {
    const existingLogo = await supabase
      .from("logos")
      .select("id")
      .eq("subject_entity_id", corporateBrandId)
      .eq("role", "corporate")
      .limit(1)
      .maybeSingle();
    if (existingLogo.error)
      throw new Error("コーポレートロゴを確認できませんでした");
    if (!existingLogo.data) {
      const logoId = newLogoId();
      const candidateId = randomUUID();
      const logoBuffer = Buffer.from(value.logo.data, "base64");
      if (
        logoBuffer.length < 8 ||
        !logoBuffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ) {
        throw new Error("取得したロゴ画像が不正です");
      }
      const filePath = isR2Configured()
        ? `logos/${logoId}/candidates/${candidateId}/master.png`
        : null;
      const embeddedSvg = filePath
        ? null
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"><image width="512" height="256" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${value.logo.data}"/></svg>`;
      if (filePath) {
        await putR2Object(
          filePath,
          logoBuffer,
          value.logo.mediaType,
          "private, max-age=0",
        );
      }
      const logoResult = await supabase.from("logos").insert({
        id: logoId,
        owner_user_id: userId,
        created_by: userId,
        updated_by: userId,
        subject_entity_id: corporateBrandId,
        title: organizationName,
        role: "corporate",
        logo_type: "combination",
        visibility: "draft",
      });
      if (logoResult.error) {
        if (filePath) await deleteR2Object(filePath);
        throw new Error("コーポレートロゴを登録できませんでした");
      }
      const candidateResult = await supabase.from("logo_candidates").insert({
        id: candidateId,
        logo_id: logoId,
        label: "公式サイトから取得（仮）",
        is_primary: true,
        svg: embeddedSvg,
        media_type: filePath ? value.logo.mediaType : "image/svg+xml",
        file_path: filePath,
        source_url: value.logo.sourceUrl,
        asset_status: "provisional",
        provenance: {
          source: "site_capture",
          source_url: sourceUrl,
          confirmed: false,
        },
      });
      if (candidateResult.error) {
        await supabase.from("logos").delete().eq("id", logoId);
        if (filePath) await deleteR2Object(filePath);
        throw new Error("ロゴ候補を保存できませんでした");
      }
      await supabase.from("logo_activities").insert({
        logo_id: logoId,
        user_id: userId,
        action: "created",
        detail: {
          source: "organization_site_capture",
          asset_status: "provisional",
        },
      });
      createdLogo = {
        id: logoId,
        title: organizationName,
        role: "corporate",
        visibility: "draft",
        previewUrl: `data:${value.logo.mediaType};base64,${value.logo.data}`,
      };
    }
  }

  return {
    profile: {
      inheritsParent: false,
      status: "confirmed",
      value: profileValue,
    },
    logo: createdLogo,
  };
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
      "id, name, organization_kind, website, industry, location, description, status, updated_at",
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

  const corporateResult = await supabase
    .from("brand_entities")
    .select("id")
    .eq("brand_organization_id", id)
    .eq("brand_kind", "corporate")
    .eq("is_primary_brand", true)
    .limit(1)
    .maybeSingle();
  if (corporateResult.error || !corporateResult.data) {
    return Response.json(
      { error: "企業ブランドを取得できませんでした" },
      { status: 409 },
    );
  }
  const corporateBrandId = corporateResult.data.id as string;

  const [
    profileResult,
    businessesResult,
    logosResult,
    availableBusinessesResult,
    organizationsResult,
  ] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("inherits_parent, status, profile")
      .eq("entity_id", corporateBrandId)
      .maybeSingle(),
    supabase
      .from("brand_entities")
      .select("id, name, website, status")
      .eq("brand_organization_id", id)
      .neq("id", corporateBrandId)
      .in("brand_kind", ["business", "audience"])
      .order("created_at", { ascending: true }),
    supabase
      .from("logos")
      .select(
        "id, title, role, visibility, logo_candidates(id, is_primary, svg, media_type, file_path)",
      )
      .eq("subject_entity_id", corporateBrandId)
      .order("created_at", { ascending: true }),
    supabase
      .from("brand_entities")
      .select("id, name, website, status, brand_organization_id")
      .eq("brand_kind", "business")
      .neq("brand_organization_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("brand_organizations")
      .select("id, name")
      .order("created_at", { ascending: true }),
  ]);
  const relatedError =
    profileResult.error ??
    businessesResult.error ??
    logosResult.error ??
    availableBusinessesResult.error ??
    organizationsResult.error;
  if (relatedError) {
    return Response.json(
      { error: "関連するブランド情報を取得できませんでした" },
      { status: 500 },
    );
  }

  const row = entityResult.data;
  const logos = await Promise.all(
    ((logosResult.data ?? []) as unknown as OrganizationLogoRow[]).map(
      organizationLogoSummary,
    ),
  );
  const organizationNames = new Map(
    (organizationsResult.data ?? []).map((organization) => [
      organization.id as string,
      organization.name as string,
    ]),
  );
  const availableBusinesses = (availableBusinessesResult.data ?? []).flatMap(
    (business) => {
      const parentId = business.brand_organization_id as string | null;
      const parentName = parentId ? organizationNames.get(parentId) : null;
      if (!parentId || !parentName) return [];
      return [
        {
          id: business.id as string,
          name: business.name as string,
          website: (business.website as string) ?? "",
          status: business.status as OrganizationDetail["status"],
          parentOrganization: { id: parentId, name: parentName },
        },
      ];
    },
  );
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
    profile: profileResult.data
      ? {
          inheritsParent: profileResult.data.inherits_parent as boolean,
          status: profileResult.data.status as OrganizationDetail["status"],
          value: (profileResult.data.profile as Record<string, unknown>) ?? {},
        }
      : null,
    businesses: (businessesResult.data ??
      []) as OrganizationDetail["businesses"],
    logos,
    availableBusinesses,
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
      ? brandImport(body.brandImport)
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
    const savedBrand = importedBrand && corporate?.data
      ? await saveOrganizationBrandAssets({
          supabase,
          userId: user.id,
          corporateBrandId: corporate.data.id as string,
          organizationName: name,
          sourceUrl,
          value: importedBrand,
        })
      : null;

    return Response.json(
      {
        ok: true,
        profile: savedBrand?.profile ?? null,
        logo: savedBrand?.logo ?? null,
      },
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
    const [assetsResult, runsResult, logosResult] = await Promise.all([
      supabase
        .from("brand_assets")
        .select("id")
        .in("brand_id", brandIds)
        .limit(1),
      supabase
        .from("brand_generation_runs")
        .select("id")
        .in("brand_id", brandIds)
        .limit(1),
      supabase
        .from("logos")
        .select("id")
        .in("subject_entity_id", brandIds)
        .limit(1),
    ]);
    const relatedError =
      assetsResult.error ?? runsResult.error ?? logosResult.error;
    if (relatedError) throw new Error("関連データを確認できませんでした");
    if (
      (assetsResult.data?.length ?? 0) > 0 ||
      (runsResult.data?.length ?? 0) > 0 ||
      (logosResult.data?.length ?? 0) > 0
    ) {
      return Response.json(
        { error: "ブランドアセットまたは生成履歴があるため削除できません" },
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

    // Existing containers may still have their pre-0021 compatibility row.
    const legacyDeleted = await supabase
      .from("brand_entities")
      .delete()
      .eq("id", id)
      .eq("entity_type", "organization");
    if (legacyDeleted.error) {
      throw new Error("旧Organization情報を整理できませんでした");
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
