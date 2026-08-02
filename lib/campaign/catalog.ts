import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newLogoId } from "@/lib/id";
import type { UrlRegistrationScope } from "@/lib/brand-registration";
import { deleteR2Object, isR2Configured, putR2Object } from "@/lib/r2";
import { createServerSupabaseForToken } from "@/lib/supabase/server";
import type { CampaignJob } from "./jobs";
import type { CampaignBrandKit } from "./schema";
import {
  normalizedCatalogWebsite,
  organizationCatalogSeed,
} from "./catalog-seed";

export type CampaignCatalogLink = {
  organizationId: string;
  brandId: string;
  /** @deprecated Kept while local job records and older clients are upgraded. */
  businessId: string;
  /** @deprecated The generation job ID, not a required Campaign container. */
  campaignId: string;
  generationRunId: string;
  lpAssetId: string;
  logoId: string;
  syncedAt: string;
};

type PersistCatalogInput = {
  accessToken: string;
  userId: string;
  job: CampaignJob;
  kit: CampaignBrandKit;
};

type BrandTarget = {
  organizationId: string;
  corporateBrandId: string;
  brandId: string;
  brandKind: "corporate" | "business" | "audience";
};

function throwOn(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function provisionalWordmark(name: string, color: string): string {
  const label = xml(name.trim() || "Brand");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 320"><rect width="960" height="320" rx="24" fill="#fff"/><text x="480" y="178" text-anchor="middle" dominant-baseline="middle" fill="${xml(color)}" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="700">${label}</text></svg>`;
}

async function ensureCorporateBrand(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  seed: ReturnType<typeof organizationCatalogSeed>,
  sourceUrl: string | null,
): Promise<string> {
  const existing = await supabase
    .from("brand_entities")
    .select("id")
    .eq("brand_organization_id", organizationId)
    .eq("brand_kind", "corporate")
    .eq("is_primary_brand", true)
    .limit(1)
    .maybeSingle();
  throwOn(existing.error);
  if (existing.data) return existing.data.id as string;

  const brandId = randomUUID();
  const inserted = await supabase.from("brand_entities").insert({
    id: brandId,
    name: seed.name,
    entity_type: "brand",
    website: seed.website,
    description: seed.description,
    status: "inferred",
    source_kind: sourceUrl ? "scraped" : "uploaded",
    provenance: {
      system_key: "primary_corporate_brand",
      organization_id: organizationId,
    },
    created_by: userId,
    brand_organization_id: organizationId,
    brand_kind: "corporate",
    is_primary_brand: true,
  });
  throwOn(inserted.error);
  return brandId;
}

async function findOrCreateOrganization(
  supabase: SupabaseClient,
  userId: string,
  kit: CampaignBrandKit,
  sourceUrl: string | null,
  registrationScope: UrlRegistrationScope,
): Promise<{ organizationId: string; corporateBrandId: string }> {
  const inferred = kit.organization;
  const seed = organizationCatalogSeed(kit, sourceUrl, registrationScope);
  const existing = await supabase
    .from("brand_organizations")
    .select("id")
    .eq("created_by", userId)
    .eq("name", seed.name)
    .limit(1)
    .maybeSingle();
  throwOn(existing.error);

  const organizationId = (existing.data?.id as string | undefined) ?? randomUUID();
  if (!existing.data) {
    const inserted = await supabase.from("brand_organizations").insert({
      id: organizationId,
      name: seed.name,
      organization_kind: seed.organizationKind,
      website: seed.website,
      description: seed.description,
      status: "inferred",
      source_kind: sourceUrl ? "scraped" : "uploaded",
      provenance: {
        name: {
          source:
            seed.nameSource === "page_classification"
              ? "user_classified_page"
              : sourceUrl
                ? "scraped_inferred"
                : "uploaded_inferred",
          confidence:
            seed.nameSource === "page_classification"
              ? "medium"
              : inferred?.confidence ?? "low",
          evidence: inferred?.evidence ?? null,
        },
        website: { source: sourceUrl ? "source_url" : "unknown" },
      },
      created_by: userId,
    });
    throwOn(inserted.error);
  }

  return {
    organizationId,
    corporateBrandId: await ensureCorporateBrand(
      supabase,
      userId,
      organizationId,
      seed,
      sourceUrl,
    ),
  };
}

async function findOrCreateBusinessBrand(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  corporateBrandId: string,
  kit: CampaignBrandKit,
  sourceUrl: string | null,
): Promise<string> {
  const existing = await supabase
    .from("brand_entities")
    .select("id")
    .eq("created_by", userId)
    .eq("brand_organization_id", organizationId)
    .eq("brand_kind", "business")
    .eq("name", kit.service.name)
    .limit(1)
    .maybeSingle();
  throwOn(existing.error);
  if (existing.data) return existing.data.id as string;

  const brandId = randomUUID();
  const inserted = await supabase.from("brand_entities").insert({
    id: brandId,
    name: kit.service.name,
    entity_type: "brand",
    website: normalizedCatalogWebsite(kit.service.url ?? sourceUrl),
    industry: kit.service.industry,
    description: kit.service.description,
    status: "inferred",
    source_kind: sourceUrl ? "scraped" : "uploaded",
    provenance: {
      name: { source: "generation_brand_kit", confidence: "medium" },
      description: { source: "generation_brand_kit", confidence: "medium" },
      parent_brand_id: {
        source: "organization_primary_brand",
        confidence: kit.organization?.confidence ?? "low",
      },
    },
    created_by: userId,
    brand_organization_id: organizationId,
    brand_kind: "business",
    parent_brand_id: corporateBrandId,
  });
  throwOn(inserted.error);
  return brandId;
}

async function selectedBrandTarget(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandTarget> {
  const selected = await supabase
    .from("brand_entities")
    .select("id, brand_organization_id, brand_kind")
    .eq("id", brandId)
    .in("brand_kind", ["corporate", "business", "audience"])
    .maybeSingle();
  throwOn(selected.error);
  if (!selected.data?.brand_organization_id || !selected.data.brand_kind) {
    throw new Error("選択したブランドを確認できませんでした");
  }

  const corporate = await supabase
    .from("brand_entities")
    .select("id")
    .eq("brand_organization_id", selected.data.brand_organization_id)
    .eq("brand_kind", "corporate")
    .eq("is_primary_brand", true)
    .limit(1)
    .maybeSingle();
  throwOn(corporate.error);
  if (!corporate.data) {
    throw new Error("企業ブランドを確認できませんでした");
  }

  return {
    organizationId: selected.data.brand_organization_id as string,
    corporateBrandId: corporate.data.id as string,
    brandId: selected.data.id as string,
    brandKind: selected.data.brand_kind as BrandTarget["brandKind"],
  };
}

async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  profile: Record<string, unknown>,
  provenance: Record<string, unknown>,
): Promise<void> {
  const existing = await supabase
    .from("brand_profiles")
    .select("status, profile, provenance")
    .eq("entity_id", brandId)
    .maybeSingle();
  throwOn(existing.error);
  if (existing.data?.status === "confirmed") return;

  const saved = await supabase.from("brand_profiles").upsert(
    {
      entity_id: brandId,
      inherits_parent: true,
      status: "inferred",
      profile: {
        ...((existing.data?.profile as Record<string, unknown> | null) ?? {}),
        ...profile,
      },
      provenance: {
        ...((existing.data?.provenance as Record<string, unknown> | null) ?? {}),
        ...provenance,
      },
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entity_id" },
  );
  throwOn(saved.error);
}

async function findOrCreateLogo(
  supabase: SupabaseClient,
  userId: string,
  target: BrandTarget,
  kit: CampaignBrandKit,
): Promise<string> {
  const subjectIds = Array.from(
    new Set([target.brandId, target.corporateBrandId]),
  );
  const existing = await supabase
    .from("logos")
    .select("id, subject_entity_id, role")
    .in("subject_entity_id", subjectIds)
    .order("created_at", { ascending: true })
    .limit(20);
  throwOn(existing.error);
  const reusable =
    existing.data?.find((logo) => logo.subject_entity_id === target.brandId) ??
    existing.data?.find(
      (logo) =>
        logo.subject_entity_id === target.corporateBrandId &&
        logo.role === "corporate",
    );
  if (reusable) return reusable.id as string;

  const logoId = newLogoId();
  const candidateId = randomUUID();
  let filePath: string | null = null;
  let mediaType = "image/svg+xml";
  let svg: string | null = null;

  const captured = kit.assets?.logo;
  if (captured && isR2Configured()) {
    filePath = `logos/${logoId}/candidates/${candidateId}/master.png`;
    mediaType = captured.media_type;
    await putR2Object(
      filePath,
      Buffer.from(captured.data, "base64"),
      captured.media_type,
      "private, max-age=0",
    );
  } else {
    svg = provisionalWordmark(
      target.brandKind === "corporate"
        ? kit.organization?.name ?? kit.service.name
        : kit.service.name,
      kit.brand.primary,
    );
  }

  const logoInsert = await supabase.from("logos").insert({
    id: logoId,
    owner_user_id: userId,
    created_by: userId,
    updated_by: userId,
    subject_entity_id: target.brandId,
    title:
      target.brandKind === "corporate"
        ? kit.organization?.name ?? kit.service.name
        : kit.service.name,
    role: target.brandKind === "corporate" ? "corporate" : "service",
    logo_type: "combination",
    visibility: "draft",
  });
  throwOn(logoInsert.error);

  const candidateInsert = await supabase.from("logo_candidates").insert({
    id: candidateId,
    logo_id: logoId,
    label: "サイトから取得（仮）",
    is_primary: true,
    svg,
    media_type: mediaType,
    file_path: filePath,
    source_url: kit.assets?.source_url ?? null,
    asset_status: "provisional",
    provenance: {
      source: captured ? "site_capture" : "generated_wordmark_fallback",
      confirmed: false,
    },
  });
  if (candidateInsert.error) {
    await supabase.from("logos").delete().eq("id", logoId);
    if (filePath) await deleteR2Object(filePath);
    throwOn(candidateInsert.error);
  }

  await supabase.from("logo_activities").insert({
    logo_id: logoId,
    user_id: userId,
    action: "created",
    detail: { source: "brand_generation", asset_status: "provisional" },
  });
  return logoId;
}

async function saveGenerationRun(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  job: CampaignJob,
  kit: CampaignBrandKit,
): Promise<string> {
  const existing = await supabase
    .from("brand_generation_runs")
    .select("id")
    .eq("external_job_id", job.id)
    .maybeSingle();
  throwOn(existing.error);

  const runId = (existing.data?.id as string | undefined) ?? randomUUID();
  const row = {
    brand_id: brandId,
    external_job_id: job.id,
    status: "succeeded",
    input: {
      source_url: job.input.url,
      has_text: job.input.hasText,
      file_count: job.input.files,
      file_kinds: job.input.fileKinds ?? [],
      registration_scope: job.input.registrationScope ?? "business",
      selected_brand_id: job.input.brandEntityId ?? null,
    },
    steps: job.steps,
    usage: job.meta?.usage ?? {},
    metadata: { brand_kit_snapshot: kit },
    error_message: null,
    triggered_by: userId,
    started_at: job.createdAt,
    finished_at: job.updatedAt,
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from("brand_generation_runs").update(row).eq("id", runId)
    : await supabase.from("brand_generation_runs").insert({ id: runId, ...row });
  throwOn(saved.error);
  return runId;
}

async function saveLpAsset(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  generationRunId: string,
  job: CampaignJob,
  kit: CampaignBrandKit,
): Promise<string> {
  const publicPath = `/c/${job.id}`;
  const existing = await supabase
    .from("brand_assets")
    .select("id")
    .eq("generation_run_id", generationRunId)
    .eq("asset_kind", "lp")
    .eq("public_path", publicPath)
    .maybeSingle();
  throwOn(existing.error);

  const assetId = (existing.data?.id as string | undefined) ?? randomUUID();
  const row = {
    brand_id: brandId,
    generation_run_id: generationRunId,
    asset_kind: "lp",
    title: `${kit.service.name} LP`,
    status: "ready",
    source_kind: "generated",
    public_path: publicPath,
    metadata: {
      generated_at: job.updatedAt,
      brand_kit_snapshot: kit,
    },
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from("brand_assets").update(row).eq("id", assetId)
    : await supabase.from("brand_assets").insert({
        id: assetId,
        created_at: job.createdAt,
        ...row,
      });
  throwOn(saved.error);
  return assetId;
}

export async function persistCampaignCatalog({
  accessToken,
  userId,
  job,
  kit,
}: PersistCatalogInput): Promise<CampaignCatalogLink> {
  const supabase = createServerSupabaseForToken(accessToken);
  const sourceUrl = job.input.url;
  const registrationScope = job.input.registrationScope ?? "business";

  let target: BrandTarget;
  if (job.input.brandEntityId) {
    target = await selectedBrandTarget(supabase, job.input.brandEntityId);
  } else {
    const base = await findOrCreateOrganization(
      supabase,
      userId,
      kit,
      sourceUrl,
      registrationScope,
    );
    const useCorporateBrand = registrationScope === "organization";
    const brandId = useCorporateBrand
      ? base.corporateBrandId
      : await findOrCreateBusinessBrand(
          supabase,
          userId,
          base.organizationId,
          base.corporateBrandId,
          kit,
          sourceUrl,
        );
    target = {
      ...base,
      brandId,
      brandKind: useCorporateBrand ? "corporate" : "business",
    };
  }

  const targetIsCorporate = target.brandId === target.corporateBrandId;
  await Promise.all([
    saveProfile(
      supabase,
      userId,
      target.corporateBrandId,
      {
        organization: kit.organization ?? null,
        ...(targetIsCorporate
          ? {
              palette: kit.brand,
              design_tokens: kit.design_tokens,
              theme: kit.theme ?? null,
            }
          : {}),
      },
      {
        organization: {
          source: sourceUrl ? "scraped_inferred" : "uploaded_inferred",
          confidence: kit.organization?.confidence ?? "low",
        },
        ...(targetIsCorporate
          ? {
              palette: {
                source:
                  kit.brand.palette_source === "extracted"
                    ? "site_evidence"
                    : "generated",
                confidence:
                  kit.brand.palette_source === "extracted" ? "high" : "low",
              },
              design_tokens: { source: "site_capture", confidence: "medium" },
            }
          : {}),
      },
    ),
    ...(targetIsCorporate
      ? []
      : [
          saveProfile(
            supabase,
            userId,
            target.brandId,
            {
              service: kit.service,
              palette: kit.brand,
              design_tokens: kit.design_tokens,
              theme: kit.theme ?? null,
            },
            {
              service: {
                source: "generation_brand_kit",
                confidence: "medium",
              },
              palette: {
                source:
                  kit.brand.palette_source === "extracted"
                    ? "site_evidence"
                    : "generated",
                confidence:
                  kit.brand.palette_source === "extracted" ? "high" : "low",
              },
              design_tokens: { source: "site_capture", confidence: "medium" },
            },
          ),
        ]),
  ]);

  const logoId = await findOrCreateLogo(supabase, userId, target, kit);
  const generationRunId = await saveGenerationRun(
    supabase,
    userId,
    target.brandId,
    job,
    kit,
  );
  const lpAssetId = await saveLpAsset(
    supabase,
    userId,
    target.brandId,
    generationRunId,
    job,
    kit,
  );
  const now = new Date().toISOString();

  return {
    organizationId: target.organizationId,
    brandId: target.brandId,
    businessId: target.brandId,
    campaignId: job.id,
    generationRunId,
    lpAssetId,
    logoId,
    syncedAt: now,
  };
}
