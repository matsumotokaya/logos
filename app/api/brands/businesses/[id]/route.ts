import { guardLabsRequest } from "@/lib/labs-access";
import type { BusinessDetail, BusinessUpdate } from "@/lib/brand-detail";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";
import { knowledgeProfilesByBrand } from "@/lib/brand/knowledge";
import {
  parseBrandImport,
  saveBrandAssetsFromUrl,
} from "@/lib/brand/import-assets";
import {
  LOGO_PREVIEW_COLUMNS,
  logoPreviewUrl,
  type LogoPreviewCandidate,
} from "@/lib/brand/logo-preview";
import { listTakeAssetsByBrand } from "@/lib/takes/read-model";

const MANAGER_ROLES = ["owner", "admin", "editor"];

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

type OrganizationRow = {
  id: string;
  name: string;
  status: BusinessDetail["status"];
  created_by: string | null;
  linked_org_id: string | null;
};

function manageableOrganizations(
  rows: OrganizationRow[],
  userId: string,
  managedWorkspaceIds: Set<string>,
): BusinessDetail["availableOrganizations"] {
  return rows
    .filter(
      (row) =>
        row.created_by === userId ||
        (row.linked_org_id !== null && managedWorkspaceIds.has(row.linked_org_id)),
    )
    .map((row) => ({ id: row.id, name: row.name, status: row.status }));
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
    .from("brand_entities")
    .select(
      "id, name, brand_organization_id, brand_kind, parent_brand_id, website, industry, location, description, status, updated_at",
    )
    .eq("id", id)
    .in("brand_kind", [
      "corporate",
      "business",
      "service",
      "product",
      "media",
      "event",
      "audience",
    ])
    .maybeSingle();
  if (entityResult.error) {
    return Response.json({ error: "事業を取得できませんでした" }, { status: 500 });
  }
  if (!entityResult.data) {
    return Response.json({ error: "事業が見つかりません" }, { status: 404 });
  }

  const parentId = entityResult.data.brand_organization_id as string | null;
  if (!parentId) {
    return Response.json(
      { error: "この事業にはOrganizationが設定されていません" },
      { status: 409 },
    );
  }

  const [
    knowledgeResult,
    logosResult,
    takeAssetsResult,
    audiencesResult,
    organizationsResult,
    membershipsResult,
  ] = await Promise.all([
    knowledgeProfilesByBrand(supabase, [id]),
    supabase
      .from("logos")
      .select(
        `id, title, role, visibility, logo_candidates(${LOGO_PREVIEW_COLUMNS})`,
      )
      .eq("subject_entity_id", id)
      .order("created_at", { ascending: true }),
    listTakeAssetsByBrand(supabase, [id]),
    supabase
      .from("brand_entities")
      .select("id, name, status")
      .eq("parent_brand_id", id)
      .eq("brand_kind", "audience")
      .order("created_at", { ascending: true }),
    supabase
      .from("brand_organizations")
      .select("id, name, status, created_by, linked_org_id")
      .order("created_at", { ascending: true }),
    supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .in("role", MANAGER_ROLES),
  ]);

  const relatedError =
    knowledgeResult.error ??
    logosResult.error ??
    takeAssetsResult.error ??
    audiencesResult.error ??
    organizationsResult.error ??
    membershipsResult.error;
  if (relatedError) {
    return Response.json({ error: "事業に関連する情報を取得できませんでした" }, { status: 500 });
  }

  const organizations = (organizationsResult.data ?? []) as OrganizationRow[];
  const parent = organizations.find((organization) => organization.id === parentId);
  if (!parent) {
    return Response.json(
      { error: "所属するOrganizationを取得できませんでした" },
      { status: 409 },
    );
  }
  const managedWorkspaceIds = new Set(
    (membershipsResult.data ?? []).map((membership) => membership.org_id as string),
  );
  const availableOrganizations = manageableOrganizations(
    organizations,
    user.id,
    managedWorkspaceIds,
  );
  if (!availableOrganizations.some((organization) => organization.id === parent.id)) {
    availableOrganizations.unshift({ id: parent.id, name: parent.name, status: parent.status });
  }

  const row = entityResult.data;
  const knowledgeProfile = knowledgeResult.data.get(id) ?? {};
  const detail: BusinessDetail = {
    id: row.id as string,
    kind: row.brand_kind as BusinessDetail["kind"],
    name: row.name as string,
    website: (row.website as string) ?? "",
    industry: (row.industry as string) ?? "",
    location: (row.location as string) ?? "",
    description: (row.description as string) ?? "",
    status: row.status as BusinessDetail["status"],
    updatedAt: row.updated_at as string,
    parentOrganization: { id: parent.id, name: parent.name },
    profile: Object.keys(knowledgeProfile).length > 0
      ? {
          inheritsParent: true,
          status: "confirmed",
          value: knowledgeProfile,
        }
      : null,
    logos: await Promise.all(
      (logosResult.data ?? []).map(async (logo) => ({
        id: logo.id as string,
        title: logo.title as string,
        role: logo.role as string,
        visibility: logo.visibility as string,
        previewUrl: await logoPreviewUrl(
          (logo.logo_candidates ?? []) as LogoPreviewCandidate[],
        ),
      })),
    ),
    campaigns: (takeAssetsResult.data.get(id) ?? [])
        .filter((asset) => asset.kind === "lp")
        .map((asset) => ({
          id: asset.id,
          jobId: asset.jobId,
          name: asset.title.replace(/\s+LP$/, ""),
          status: asset.status,
          createdAt: asset.createdAt,
        })),
    audiences: (audiencesResult.data ?? []) as BusinessDetail["audiences"],
    availableOrganizations,
  };

  return Response.json({ business: detail }, { headers: { "Cache-Control": "no-store" } });
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
    const body = (await req.json()) as Partial<BusinessUpdate> & {
      brandImport?: unknown;
    };
    // The capture that produced the name also produced the palette, the design
    // tokens and the logo. This screen used to keep the three text fields and
    // drop the rest, which is why a brand could sit here with a full set of
    // knowledge claims and no logo to show for it.
    const importedBrand = parseBrandImport(body.brandImport);
    const name = text(body.name, "事業名", 160);
    if (!name) throw new Error("事業名を入力してください");
    const parentOrganizationId = text(
      body.parentOrganizationId,
      "取り込み先Organization",
      64,
    );
    if (!parentOrganizationId) throw new Error("取り込み先Organizationを選択してください");

    const current = await supabase
      .from("brand_entities")
      .select("brand_organization_id, brand_kind, parent_brand_id, provenance")
      .eq("id", id)
      .in("brand_kind", [
        "corporate",
        "business",
        "service",
        "product",
        "media",
        "event",
        "audience",
      ])
      .maybeSingle();
    if (current.error) throw new Error("事業を確認できませんでした");
    if (!current.data) {
      return Response.json({ error: "事業が見つかりません" }, { status: 404 });
    }

    const target = await supabase
      .from("brand_organizations")
      .select("id, linked_org_id")
      .eq("id", parentOrganizationId)
      .maybeSingle();
    if (target.error || !target.data) {
      throw new Error("取り込み先Organizationを確認できませんでした");
    }

    const now = new Date().toISOString();
    const fields = ["name", "website", "industry", "location", "description"];
    const parentChanged =
      current.data.brand_organization_id !== parentOrganizationId;
    if (parentChanged && current.data.brand_kind === "corporate") {
      throw new Error("企業ブランドは所属Organizationから移動できません");
    }
    if (parentChanged && current.data.brand_kind === "audience") {
      throw new Error("対象別ブランドは親となる事業ブランドから移動してください");
    }
    const targetCorporate = await supabase
      .from("brand_entities")
      .select("id")
      .eq("brand_organization_id", parentOrganizationId)
      .eq("brand_kind", "corporate")
      .eq("is_primary_brand", true)
      .limit(1)
      .maybeSingle();
    if (targetCorporate.error || !targetCorporate.data) {
      throw new Error("移動先の企業ブランドを確認できませんでした");
    }
    const provenance = {
      ...((current.data.provenance as Record<string, unknown> | null) ?? {}),
      ...Object.fromEntries(
        fields.map((field) => [
          field,
          { source: "user_confirmed", confirmed_at: now, confirmed_by: user.id },
        ]),
      ),
      ...(parentChanged
        ? {
            brand_organization_id: {
              source: "user_reparented",
              confirmed_at: now,
              confirmed_by: user.id,
            },
          }
        : {}),
    };

    const updated = await supabase
      .from("brand_entities")
      .update({
        name,
        brand_organization_id: parentOrganizationId,
        parent_brand_id:
          current.data.brand_kind === "business"
            ? targetCorporate.data.id
            : current.data.parent_brand_id,
        linked_org_id: target.data.linked_org_id,
        website: website(body.website),
        industry: text(body.industry, "業種", 160),
        location: text(body.location, "所在地", 240),
        description: text(body.description, "説明", 4000),
        status: "confirmed",
        source_kind: "manual",
        provenance,
        updated_at: now,
      })
      .eq("id", id)
      .in("brand_kind", [
        "corporate",
        "business",
        "service",
        "product",
        "media",
        "event",
        "audience",
      ])
      .select("id")
      .maybeSingle();
    if (updated.error) {
      throw new Error(
        parentChanged
          ? "このOrganizationへ事業を取り込む権限がありません"
          : "事業を保存できませんでした",
      );
    }
    if (!updated.data) throw new Error("この事業を編集する権限がありません");

    // Assets are applied after the entity update so a rejected edit never
    // leaves a refreshed logo attached to stale brand facts.
    const savedBrand = importedBrand
      ? await saveBrandAssetsFromUrl({
          supabase,
          userId: user.id,
          brandId: id,
          brandName: name,
          role: current.data.brand_kind === "corporate" ? "corporate" : "service",
          sourceUrl: website(body.website),
          value: importedBrand,
        })
      : null;

    return Response.json(
      {
        ok: true,
        parentChanged,
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

// Removing one Brand.
//
// Postgres already refuses this while takes, works or materials point at the
// brand (`on delete restrict`), and that refusal is the design: a brand is not
// a folder you can throw away with its contents inside. What Postgres would
// *not* stop is the quiet damage — `logos.subject_entity_id` and
// `brand_entities.parent_brand_id` are `on delete set null`, so deleting a brand
// that still owns a logo or has a child brand would leave them alive and
// unreachable from any tree. Both are checked here, in front of the FK, so the
// answer is one sentence about what to do rather than a constraint name.
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
    const brand = await supabase
      .from("brand_entities")
      .select("id, name, brand_organization_id")
      .eq("id", id)
      .maybeSingle();
    if (brand.error) throw new Error("ブランドを確認できませんでした");
    if (!brand.data) {
      return Response.json({ error: "ブランドが見つかりません" }, { status: 404 });
    }

    const [takes, works, materials, logos, children] = await Promise.all([
      supabase.from("takes").select("id", { count: "exact", head: true }).eq("brand_id", id),
      supabase.from("works").select("id", { count: "exact", head: true }).eq("brand_id", id),
      supabase
        .from("brand_materials")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", id),
      supabase
        .from("logos")
        .select("id", { count: "exact", head: true })
        .eq("subject_entity_id", id),
      supabase
        .from("brand_entities")
        .select("id", { count: "exact", head: true })
        .eq("parent_brand_id", id),
    ]);
    const countError =
      takes.error ?? works.error ?? materials.error ?? logos.error ?? children.error;
    if (countError) throw new Error("関連データを確認できませんでした");

    const blocking: string[] = [];
    if ((logos.count ?? 0) > 0) blocking.push(`ロゴ${logos.count}件`);
    if ((takes.count ?? 0) > 0) blocking.push(`動画・LP${takes.count}件`);
    if ((works.count ?? 0) > 0) blocking.push(`Work${works.count}件`);
    if ((materials.count ?? 0) > 0) blocking.push(`素材${materials.count}件`);
    if ((children.count ?? 0) > 0) blocking.push(`子ブランド${children.count}件`);
    if (blocking.length > 0) {
      return Response.json(
        {
          error: `${blocking.join("・")}が残っているため削除できません。先に削除または移動してください`,
        },
        { status: 409 },
      );
    }

    const deleted = await supabase
      .from("brand_entities")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (deleted.error) throw new Error("ブランドを削除できませんでした");
    if (!deleted.data) {
      return Response.json(
        { error: "このブランドを削除する権限がありません" },
        { status: 403 },
      );
    }

    return Response.json(
      { ok: true, organizationId: brand.data.brand_organization_id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "削除できませんでした" },
      { status: 500 },
    );
  }
}
