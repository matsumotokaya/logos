import { guardLabsRequest } from "@/lib/labs-access";
import type {
  BrandAssetSummary,
  BrandCampaignSummary,
  BrandLogoSummary,
  BrandOrganizationSummary,
  BrandRecordStatus,
  BrandSummary,
} from "@/lib/brand-hierarchy";
import { campaignCmMp4Exists, getCampaignJob } from "@/lib/campaign/jobs";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import { resolveCampaignJobId } from "@/lib/video/job-id";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

type OrganizationRow = {
  id: string;
  name: string;
  organization_kind: BrandOrganizationSummary["organizationKind"];
  website: string;
  description: string;
  status: BrandRecordStatus;
};

type BrandRow = {
  id: string;
  brand_organization_id: string;
  parent_brand_id: string | null;
  brand_kind: BrandSummary["kind"];
  is_primary_brand: boolean;
  name: string;
  website: string;
  industry: string;
  description: string;
  status: BrandRecordStatus;
};

type ProfileRow = {
  entity_id: string;
  inherits_parent: boolean;
  profile: Record<string, unknown>;
};

type LogoRow = {
  id: string;
  subject_entity_id: string;
  title: string;
  role: string;
  visibility: string;
};

type GenerationRunRow = {
  id: string;
  external_job_id: string | null;
  legacy_campaign_id: string | null;
};

type AssetRow = {
  id: string;
  brand_id: string;
  generation_run_id: string | null;
  legacy_campaign_id: string | null;
  asset_kind: BrandAssetSummary["kind"];
  title: string;
  status: BrandAssetSummary["status"];
  public_path: string | null;
  created_at: string;
};

function mergeProfile(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
        ? mergeProfile(
            current as Record<string, unknown>,
            value as Record<string, unknown>,
          )
        : value;
  }
  return merged;
}

function paletteFrom(value: Record<string, unknown>): {
  primary: string | null;
  accent: string | null;
  fontStyle: string | null;
} {
  const palette = value.palette;
  if (!palette || typeof palette !== "object") {
    return { primary: null, accent: null, fontStyle: null };
  }
  const row = palette as Record<string, unknown>;
  return {
    primary: typeof row.primary === "string" ? row.primary : null,
    accent: typeof row.accent === "string" ? row.accent : null,
    fontStyle: typeof row.font_style === "string" ? row.font_style : null,
  };
}

function campaignStatus(
  status: BrandAssetSummary["status"],
): BrandCampaignSummary["status"] {
  if (status === "pending") return "running";
  if (status === "failed") return "failed";
  if (status === "archived") return "archived";
  return "draft";
}

export async function GET(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);
  const supabase = createServerSupabaseForToken(user.token);

  const organizationResult = await supabase
    .from("brand_organizations")
    .select("id, name, organization_kind, website, description, status")
    // Newest first: the left pane is a work surface, so what was just
    // registered has to be at the top instead of scrolling off the bottom.
    .order("created_at", { ascending: false });
  if (organizationResult.error) {
    return Response.json(
      { error: "Organizationを取得できませんでした" },
      { status: 500 },
    );
  }

  const organizations = (organizationResult.data ?? []) as OrganizationRow[];
  if (organizations.length === 0) {
    return Response.json(
      { organizations: [] satisfies BrandOrganizationSummary[] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const organizationIds = organizations.map((organization) => organization.id);
  const brandResult = await supabase
    .from("brand_entities")
    .select(
      "id, brand_organization_id, parent_brand_id, brand_kind, is_primary_brand, name, website, industry, description, status",
    )
    .in("brand_organization_id", organizationIds)
    .in("brand_kind", ["corporate", "business", "audience"])
    .order("created_at", { ascending: false });
  if (brandResult.error) {
    return Response.json(
      { error: "ブランドを取得できませんでした" },
      { status: 500 },
    );
  }

  const brands = (brandResult.data ?? []) as BrandRow[];
  const brandIds = brands.map((brand) => brand.id);
  if (brandIds.length === 0) {
    return Response.json(
      {
        organizations: organizations.map(
          (organization): BrandOrganizationSummary => ({
            id: organization.id,
            name: organization.name,
            organizationKind: organization.organization_kind,
            website: organization.website,
            description: organization.description,
            status: organization.status,
            logos: [],
            brands: [],
            businesses: [],
          }),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [profileResult, logoResult, runResult, assetResult] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("entity_id, inherits_parent, profile")
      .in("entity_id", brandIds),
    supabase
      .from("logos")
      .select("id, subject_entity_id, title, role, visibility")
      .in("subject_entity_id", brandIds),
    supabase
      .from("brand_generation_runs")
      .select("id, external_job_id, legacy_campaign_id")
      .in("brand_id", brandIds),
    supabase
      .from("brand_assets")
      .select(
        "id, brand_id, generation_run_id, legacy_campaign_id, asset_kind, title, status, public_path, created_at",
      )
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false }),
  ]);
  const relatedError =
    profileResult.error ??
    logoResult.error ??
    runResult.error ??
    assetResult.error;
  if (relatedError) {
    return Response.json(
      { error: "ブランド関連データを取得できませんでした" },
      { status: 500 },
    );
  }

  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((row) => [
      row.entity_id,
      row,
    ]),
  );
  const logos = new Map<string, LogoRow[]>();
  for (const row of (logoResult.data ?? []) as LogoRow[]) {
    const current = logos.get(row.subject_entity_id) ?? [];
    current.push(row);
    logos.set(row.subject_entity_id, current);
  }
  const runs = new Map(
    ((runResult.data ?? []) as GenerationRunRow[]).map((run) => [run.id, run]),
  );
  const rawAssets = (assetResult.data ?? []) as AssetRow[];
  const assets = new Map<string, BrandAssetSummary[]>();
  for (const row of rawAssets) {
    const current = assets.get(row.brand_id) ?? [];
    current.push({
      id: row.id,
      kind: row.asset_kind,
      title: row.title,
      status: row.status,
      publicPath: row.public_path,
      generationRunId: row.generation_run_id,
      jobId: resolveCampaignJobId(row, runs),
      createdAt: row.created_at,
    });
    assets.set(row.brand_id, current);
  }

  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const availableLogos = (brand: BrandRow): BrandLogoSummary[] => {
    const items: BrandLogoSummary[] = [];
    const seen = new Set<string>();
    let current: BrandRow | undefined = brand;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      for (const logo of logos.get(current.id) ?? []) {
        if (seen.has(logo.id)) continue;
        seen.add(logo.id);
        items.push({
          id: logo.id,
          title: logo.title,
          role: logo.role,
          visibility: logo.visibility,
          subjectEntityId: current.id,
          subjectEntityName: current.name,
          inherited: current.id !== brand.id,
        });
      }
      visited.add(current.id);
      current = current.parent_brand_id
        ? brandById.get(current.parent_brand_id)
        : undefined;
    }
    return items;
  };
  const resolvedProfile = (brand: BrandRow): Record<string, unknown> => {
    const chain: BrandRow[] = [];
    let current: BrandRow | undefined = brand;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      chain.unshift(current);
      visited.add(current.id);
      current = current.parent_brand_id
        ? brandById.get(current.parent_brand_id)
        : undefined;
    }
    let resolved: Record<string, unknown> = {};
    for (const member of chain) {
      const row = profiles.get(member.id);
      if (!row) continue;
      if (!row.inherits_parent) resolved = {};
      resolved = mergeProfile(resolved, row.profile);
    }
    return resolved;
  };

  const summariesByOrganization = new Map<string, BrandSummary[]>();
  for (const brand of brands) {
    const profile = paletteFrom(resolvedProfile(brand));
    const resolvedLogos = availableLogos(brand);
    const brandAssets = assets.get(brand.id) ?? [];
    const campaigns: BrandCampaignSummary[] = brandAssets
      .filter((asset) => asset.kind === "lp" && asset.jobId)
      .map((asset) => {
        const jobId = asset.jobId!;
        const job = getCampaignJob(jobId);
        return {
          id: jobId,
          name: asset.title.replace(/\s+LP$/, ""),
          status: campaignStatus(asset.status),
          logoId: resolvedLogos[0]?.id ?? null,
          primary: profile.primary,
          accent: profile.accent,
          createdAt: asset.createdAt,
          lpUrl: signedLabsUrl(
            asset.publicPath ?? `/c/${jobId}`,
            `campaign-lp:${jobId}`,
          ),
          videoStatus: campaignCmMp4Exists(jobId)
            ? "mp4_ready"
            : job?.cm?.track
              ? "preview_ready"
              : "not_created",
        };
      });
    const summary: BrandSummary = {
      id: brand.id,
      organizationId: brand.brand_organization_id,
      parentBrandId: brand.parent_brand_id,
      kind: brand.brand_kind,
      isPrimary: brand.is_primary_brand,
      name: brand.name,
      website: brand.website,
      industry: brand.industry,
      description: brand.description,
      status: brand.status,
      primary: profile.primary,
      accent: profile.accent,
      fontStyle: profile.fontStyle,
      logos: resolvedLogos,
      logoIds: resolvedLogos.map((logo) => logo.id),
      assets: brandAssets,
      campaigns,
    };
    const current = summariesByOrganization.get(brand.brand_organization_id) ?? [];
    current.push(summary);
    summariesByOrganization.set(brand.brand_organization_id, current);
  }

  const result = organizations.map(
    (organization): BrandOrganizationSummary => {
      const organizationBrands =
        summariesByOrganization.get(organization.id) ?? [];
      const corporate = organizationBrands.find(
        (brand) => brand.kind === "corporate" && brand.isPrimary,
      );
      return {
        id: organization.id,
        name: organization.name,
        organizationKind: organization.organization_kind,
        website: organization.website,
        description: organization.description,
        status: organization.status,
        logos: corporate?.logos ?? [],
        brands: organizationBrands,
        businesses: organizationBrands.filter(
          (brand) => brand.kind !== "corporate",
        ),
      };
    },
  );

  return Response.json(
    { organizations: result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
