import { guardLabsRequest } from "@/lib/labs-access";
import type { BusinessDetail, BusinessUpdate } from "@/lib/brand-detail";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

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
      "id, name, entity_type, brand_organization_id, brand_kind, parent_brand_id, website, industry, location, description, status, updated_at",
    )
    .eq("id", id)
    .in("brand_kind", ["corporate", "business", "audience"])
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
    profileResult,
    logosResult,
    assetsResult,
    runsResult,
    audiencesResult,
    organizationsResult,
    membershipsResult,
  ] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("inherits_parent, status, profile")
      .eq("entity_id", id)
      .maybeSingle(),
    supabase
      .from("logos")
      .select("id, title, role, visibility")
      .eq("subject_entity_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("brand_assets")
      .select(
        "id, title, status, created_at, public_path, legacy_campaign_id, generation_run_id",
      )
      .eq("brand_id", id)
      .eq("asset_kind", "lp")
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_generation_runs")
      .select("id, external_job_id, legacy_campaign_id")
      .eq("brand_id", id),
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
    profileResult.error ??
    logosResult.error ??
    assetsResult.error ??
    runsResult.error ??
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
  const runs = new Map(
    (runsResult.data ?? []).map((run) => [
      run.id as string,
      {
        externalJobId: run.external_job_id as string | null,
        legacyCampaignId: run.legacy_campaign_id as string | null,
      },
    ]),
  );
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
    profile: profileResult.data
      ? {
          inheritsParent: profileResult.data.inherits_parent as boolean,
          status: profileResult.data.status as BusinessDetail["status"],
          value: (profileResult.data.profile as Record<string, unknown>) ?? {},
        }
      : null,
    logos: (logosResult.data ?? []) as BusinessDetail["logos"],
    campaigns: (assetsResult.data ?? []).map((asset) => {
      const run = asset.generation_run_id
        ? runs.get(asset.generation_run_id as string)
        : undefined;
      const pathJobId = (asset.public_path as string | null)?.match(
        /^\/c\/([^/?#]+)/,
      )?.[1];
      return {
        id:
          run?.externalJobId ??
          (asset.legacy_campaign_id as string | null) ??
          run?.legacyCampaignId ??
          pathJobId ??
          (asset.id as string),
        name: (asset.title as string).replace(/\s+LP$/, ""),
        status: asset.status as string,
        createdAt: asset.created_at as string,
      };
    }),
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
    const body = (await req.json()) as Partial<BusinessUpdate>;
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
      .in("brand_kind", ["corporate", "business", "audience"])
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
        entity_type: "brand",
        parent_entity_id: null,
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
      .in("brand_kind", ["corporate", "business", "audience"])
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

    return Response.json(
      { ok: true, parentChanged },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "入力内容が不正です" },
      { status: 400 },
    );
  }
}
