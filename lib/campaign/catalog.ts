import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newLogoId } from "@/lib/id";
import type { UrlRegistrationScope } from "@/lib/brand-registration";
import { deleteR2Object, isR2Configured, putR2Object } from "@/lib/r2";
import { createServerSupabaseForToken } from "@/lib/supabase/server";
import {
  appendBrandKnowledgeClaims,
  type AppendKnowledgeField,
} from "@/lib/brand/knowledge";
import type { CampaignJob } from "./jobs";
import type { CampaignBrandKit } from "./schema";
import { resolveSubjectPlacement, type BrandKind } from "./classification";
import {
  normalizedCatalogWebsite,
  organizationCatalogSeed,
} from "./catalog-seed";

export type CampaignCatalogLink = {
  organizationId: string;
  brandId: string;
  workId: string | null;
  publishedLpTakeId?: string;
  publishedLpPath?: string;
  /** @deprecated Kept while local job records and older clients are upgraded. */
  businessId: string;
  /** @deprecated The generation job ID, not a required Campaign container. */
  campaignId: string;
  /** @deprecated New generations record execution on take_runs. */
  generationRunId?: string;
  /** @deprecated New generated outputs are Takes. */
  lpAssetId?: string;
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
  brandKind: BrandKind;
  placement: "brand" | "work";
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

  const organizationId =
    (existing.data?.id as string | undefined) ?? randomUUID();
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
              : (inferred?.confidence ?? "low"),
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

async function findOrCreateBrand(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  corporateBrandId: string,
  kit: CampaignBrandKit,
  sourceUrl: string | null,
  brandKind: Exclude<BrandKind, "corporate">,
): Promise<string> {
  const existing = await supabase
    .from("brand_entities")
    .select("id")
    .eq("created_by", userId)
    .eq("brand_organization_id", organizationId)
    .eq("brand_kind", brandKind)
    .eq("name", kit.service.name)
    .limit(1)
    .maybeSingle();
  throwOn(existing.error);
  if (existing.data) return existing.data.id as string;

  const brandId = randomUUID();
  const inserted = await supabase.from("brand_entities").insert({
    id: brandId,
    name: kit.service.name,
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
    brand_kind: brandKind,
    parent_brand_id: corporateBrandId,
  });
  throwOn(inserted.error);
  return brandId;
}

async function selectedBrandTarget(
  supabase: SupabaseClient,
  brandId: string,
  placement: "brand" | "work",
): Promise<BrandTarget> {
  const selected = await supabase
    .from("brand_entities")
    .select("id, brand_organization_id, brand_kind")
    .eq("id", brandId)
    .in("brand_kind", [
      "corporate",
      "business",
      "service",
      "product",
      "media",
      "event",
    ])
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
    placement,
  };
}

async function findOrCreateWork(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
  job: CampaignJob,
  kit: CampaignBrandKit,
): Promise<string> {
  const existing = await supabase
    .from("works")
    .select("id")
    .eq("brand_id", brandId)
    .eq("created_by", userId)
    .eq("name", kit.service.name)
    .limit(1)
    .maybeSingle();
  throwOn(existing.error);
  if (existing.data) return existing.data.id as string;

  const workId = randomUUID();
  const inserted = await supabase.from("works").insert({
    id: workId,
    brand_id: brandId,
    name: kit.service.name || `生成 ${job.id.slice(0, 8)}`,
    status: "active",
    created_by: userId,
  });
  throwOn(inserted.error);
  return workId;
}

async function saveCatalogKnowledge(
  supabase: SupabaseClient,
  userId: string,
  target: BrandTarget,
  job: CampaignJob,
  kit: CampaignBrandKit,
): Promise<void> {
  const sourceRef = { campaign_job_id: job.id, source_url: job.input.url };
  const organizationFields: AppendKnowledgeField[] = [
    { field_path: "identity.legal_name", layer: "fact", value: kit.organization?.name, confidence: "inferred" },
    { field_path: "identity.description", layer: "fact", value: kit.organization?.description, confidence: "inferred" },
  ];
  const serviceFields: AppendKnowledgeField[] = [
    { field_path: "offering.name", layer: "fact", value: kit.service.name, confidence: "inferred" },
    { field_path: "offering.tagline", layer: "fact", value: kit.service.tagline, confidence: "inferred" },
    { field_path: "offering.description", layer: "fact", value: kit.service.description, confidence: "inferred" },
    { field_path: "offering.industry", layer: "fact", value: kit.service.industry, confidence: "inferred" },
    { field_path: "offering.business_type", layer: "fact", value: kit.service.business_type, confidence: "inferred" },
    { field_path: "offering.audience", layer: "fact", value: kit.service.audience, confidence: "inferred" },
    { field_path: "offering.summary", layer: "fact", value: kit.service.offering, confidence: "inferred" },
  ];
  const expressionFields: AppendKnowledgeField[] = [
    { field_path: "palette.primary", layer: "expression", value: kit.brand.primary, confidence: "suggested" },
    { field_path: "palette.accent", layer: "expression", value: kit.brand.accent, confidence: "suggested" },
    { field_path: "palette.background", layer: "expression", value: kit.brand.background, confidence: "suggested" },
    { field_path: "palette.surface", layer: "expression", value: kit.brand.surface, confidence: "suggested" },
    { field_path: "palette.text", layer: "expression", value: kit.brand.text, confidence: "suggested" },
    { field_path: "palette.mode", layer: "expression", value: kit.brand.mode, confidence: "suggested" },
    { field_path: "palette.source", layer: "expression", value: kit.brand.palette_source, confidence: "suggested" },
    { field_path: "typography.font_style", layer: "expression", value: kit.brand.font_style, confidence: "suggested" },
    { field_path: "typography.body_font", layer: "expression", value: kit.design_tokens?.body_font, confidence: "suggested" },
    { field_path: "typography.heading_font", layer: "expression", value: kit.design_tokens?.heading_font, confidence: "suggested" },
    { field_path: "tokens.button_radius", layer: "expression", value: kit.design_tokens?.button_radius, confidence: "suggested" },
    { field_path: "tokens.button_padding", layer: "expression", value: kit.design_tokens?.button_padding, confidence: "suggested" },
    { field_path: "tokens.section_spacing", layer: "expression", value: kit.design_tokens?.section_spacing, confidence: "suggested" },
    { field_path: "tokens.container_width", layer: "expression", value: kit.design_tokens?.container_width, confidence: "suggested" },
    { field_path: "tone.theme", layer: "expression", value: kit.theme, confidence: "suggested" },
  ];

  const factsByBrand = new Map<string, AppendKnowledgeField[]>();
  factsByBrand.set(target.corporateBrandId, organizationFields);
  if (target.placement !== "work") {
    factsByBrand.set(target.brandId, [
      ...(factsByBrand.get(target.brandId) ?? []),
      ...serviceFields,
    ]);
  }
  for (const [brandId, fields] of factsByBrand) {
    const result = await appendBrandKnowledgeClaims(supabase, {
      brandId,
      fields,
      sourceKind: "llm_structuring",
      sourceRef,
      userId,
    });
    if (!result.ok) throw new Error(result.error);
  }
  if (target.placement !== "work") {
    const result = await appendBrandKnowledgeClaims(supabase, {
      brandId: target.brandId,
      fields: expressionFields,
      sourceKind:
        kit.brand.palette_source === "extracted"
          ? "url_extraction"
          : "llm_generation",
      sourceRef,
      userId,
    });
    if (!result.ok) throw new Error(result.error);
  }
}

async function findOrCreateLogo(
  supabase: SupabaseClient,
  userId: string,
  target: BrandTarget,
  kit: CampaignBrandKit,
  allowCaptured = true,
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

  const captured = allowCaptured ? kit.assets?.logo : null;
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
        ? (kit.organization?.name ?? kit.service.name)
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
        ? (kit.organization?.name ?? kit.service.name)
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

export async function persistCampaignCatalog({
  accessToken,
  userId,
  job,
  kit,
}: PersistCatalogInput): Promise<CampaignCatalogLink> {
  const supabase = createServerSupabaseForToken(accessToken);
  const sourceUrl = job.input.url;
  const classification = resolveSubjectPlacement(
    kit.classification,
    job.input.registrationScope,
  );
  const registrationScope: UrlRegistrationScope =
    classification.brandKind === "corporate" ? "organization" : "business";

  let target: BrandTarget;
  if (job.input.brandEntityId) {
    target = await selectedBrandTarget(
      supabase,
      job.input.brandEntityId,
      classification.placement,
    );
  } else {
    const base = await findOrCreateOrganization(
      supabase,
      userId,
      kit,
      sourceUrl,
      registrationScope,
    );
    const useCorporateBrand =
      classification.brandKind === "corporate" ||
      classification.placement === "work";
    const brandId = useCorporateBrand
      ? base.corporateBrandId
      : await findOrCreateBrand(
          supabase,
          userId,
          base.organizationId,
          base.corporateBrandId,
          kit,
          sourceUrl,
          classification.brandKind as Exclude<BrandKind, "corporate">,
        );
    target = {
      ...base,
      brandId,
      brandKind: useCorporateBrand ? "corporate" : classification.brandKind,
      placement: classification.placement,
    };
  }

  const isWork = target.placement === "work";
  await saveCatalogKnowledge(supabase, userId, target, job, kit);

  const workId = isWork
    ? await findOrCreateWork(supabase, userId, target.brandId, job, kit)
    : null;
  const logoId = await findOrCreateLogo(supabase, userId, target, kit, !isWork);
  const now = new Date().toISOString();

  return {
    organizationId: target.organizationId,
    brandId: target.brandId,
    workId,
    businessId: target.brandId,
    campaignId: job.id,
    logoId,
    syncedAt: now,
  };
}
