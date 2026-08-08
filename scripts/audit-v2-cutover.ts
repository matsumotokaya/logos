// Read-only cutover audit for docs/schema-v2.md §19.
//
// The contract migration removes all legacy tables, so this audits only the
// final model plus the one explicitly preserved event closure.

import { createAdminSupabase } from "@/lib/supabase/server";
import { existsSync } from "node:fs";
import path from "node:path";
import { TEMPLATES } from "@/lib/templates/catalog";
import { definitionHash } from "@/lib/templates/ledger";
import { productionTemplateDrift } from "@/lib/templates/ledger-guard";
import { headR2Object } from "@/lib/r2";

interface AuditTarget {
  label: string;
  table: string;
}

const TARGETS: AuditTarget[] = [
  { label: "brands", table: "brand_entities" },
  { label: "organizations", table: "brand_organizations" },
  { label: "works", table: "works" },
  { label: "takes", table: "takes" },
  { label: "take_runs", table: "take_runs" },
  { label: "take_renders", table: "take_renders" },
  { label: "render_artifacts", table: "render_artifacts" },
  { label: "brand_materials", table: "brand_materials" },
  { label: "take_inputs", table: "take_inputs" },
  { label: "knowledge_claims", table: "brand_knowledge_claims" },
  { label: "knowledge_values", table: "brand_knowledge_values" },
  { label: "publications", table: "publications" },
  { label: "canonical_slots", table: "canonical_slots" },
];

async function exactCount(table: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function filteredCount(
  table: string,
  column: string,
  value: null,
): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .is(column, value);
  if (error) throw new Error(`${table}.${column}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const supabase = createAdminSupabase();
  const counts = Object.fromEntries(
    await Promise.all(
      TARGETS.map(async ({ label, table }) => [label, await exactCount(table)]),
    ),
  );
  const brandsWithoutKind = await filteredCount(
    "brand_entities",
    "brand_kind",
    null,
  );
  const [productCmResult, eventResult, organizationResult, primaryBrandResult] = await Promise.all([
    supabase
      .from("takes")
      .select(
        "id, status, brief, take_inputs(role), take_renders(status, format, latest_artifact_id)",
      )
      .eq("template_id", "product-cm")
      .eq("template_version", 2),
    supabase
      .from("takes")
      .select(
        "id, status, take_inputs(material_id, brand_materials(r2_key)), take_renders(status, latest_artifact_id, render_artifacts!take_renders_latest_artifact_fkey(r2_key))",
      )
      .eq("template_id", "event-promo")
      .eq("title", "世界が恋する日本酒"),
    supabase.from("brand_organizations").select("id"),
    supabase
      .from("brand_entities")
      .select("brand_organization_id")
      .eq("brand_kind", "corporate")
      .eq("is_primary_brand", true),
  ]);
  for (const [label, result] of [
    ["product-cm takes", productCmResult],
    ["preserved event", eventResult],
    ["organizations", organizationResult],
    ["primary corporate Brands", primaryBrandResult],
  ] as const) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }
  const productCmTakes = productCmResult.data ?? [];
  const productCmPinnedVoices = productCmTakes.filter((take) => {
    const brief = take.brief as { voice?: { audio?: unknown } } | null;
    const inputs = take.take_inputs as Array<{ role: string }> | null;
    return (
      typeof brief?.voice?.audio === "string" &&
      brief.voice.audio.startsWith("material:") &&
      inputs?.some((input) => input.role === "product_cm_voice")
    );
  }).length;
  const productCmReadyOutputs = productCmTakes.filter((take) => {
    const renders = take.take_renders as Array<{
      status: string;
      format: string;
      latest_artifact_id: string | null;
    }> | null;
    return renders?.some(
      (render) =>
        render.status === "ready" &&
        render.format === "mp4" &&
        Boolean(render.latest_artifact_id),
    );
  }).length;
  const event = eventResult.data?.[0];
  const eventInputs = event?.take_inputs ?? [];
  const eventRenders = event?.take_renders ?? [];
  const eventKeys = [
    ...eventInputs.flatMap((input) => {
      const material = input.brand_materials as
        | { r2_key: string | null }
        | Array<{ r2_key: string | null }>
        | null;
      const row = Array.isArray(material) ? material[0] : material;
      return row?.r2_key ? [row.r2_key] : [];
    }),
    ...eventRenders.flatMap((render) => {
      const artifact = render.render_artifacts as
        | { r2_key: string }
        | Array<{ r2_key: string }>
        | null;
      const row = Array.isArray(artifact) ? artifact[0] : artifact;
      return row?.r2_key ? [row.r2_key] : [];
    }),
  ];
  const eventR2Ready =
    eventKeys.length === 14 &&
    (await Promise.all(eventKeys.map((key) => headR2Object(key)))).every(Boolean);
  const organizationsWithPrimaryBrand = new Set(
    (primaryBrandResult.data ?? []).map((row) => row.brand_organization_id as string),
  );
  const organizationsWithoutPrimaryBrand = (organizationResult.data ?? []).filter(
    (organization) => !organizationsWithPrimaryBrand.has(organization.id as string),
  ).length;
  const { data: ledger, error: ledgerError } = await supabase
    .from("template_versions")
    .select("template_id, version, definition_hash, stage");
  if (ledgerError) {
    throw new Error(`template_versions: ${ledgerError.message}`);
  }
  const templateDrift = productionTemplateDrift(
    (ledger ?? []).map((row) => ({
      template_id: row.template_id as string,
      version: row.version as number,
      definition_hash: row.definition_hash as string,
      stage: row.stage as string,
    })),
    TEMPLATES.map((template) => ({
      template_id: template.id,
      version: template.version,
      definition_hash: definitionHash(template),
    })),
  );
  const publicationManagementConnected = [
    "app/api/brands/[id]/lps/[takeId]/route.ts",
    "app/(management)/brands/[id]/lp/[jobId]/BrandLpDetail.tsx",
    "app/c/[id]/route.ts",
  ].every((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
  const productCmPipelineConnected = [
    "lib/takes/product-cm.ts",
    "app/api/labs/campaign/voice/route.ts",
    "app/api/brands/[id]/videos/[videoId]/render/route.ts",
    "app/api/brands/[id]/videos/[videoId]/route.ts",
    "app/v/[id]/route.ts",
  ].every((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
  const logoPresentationPipelineConnected = [
    "supabase/migrations/0041_logo_presentation_takes.sql",
    "lib/store/supabase.ts",
    "lib/templates/brief-schemas.ts",
  ].every((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
  const existingBrandLogoIntakeConnected = [
    "supabase/migrations/0046_create_logo_for_existing_brand.sql",
    "app/api/brands/[id]/logos/route.ts",
    "app/campaigns/businesses/[id]/BrandLogoAssets.tsx",
  ].every((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
  const contractMigrationPresent = existsSync(
    path.join(process.cwd(), "supabase/migrations/0042_finish_v2_contract.sql"),
  );

  console.table({
    ...counts,
    publication_management_connected: publicationManagementConnected,
    product_cm_v2_takes: productCmTakes.length,
    product_cm_pinned_voices: productCmPinnedVoices,
    product_cm_ready_outputs: productCmReadyOutputs,
    product_cm_pipeline_connected: productCmPipelineConnected,
    logo_presentation_pipeline_connected: logoPresentationPipelineConnected,
    existing_brand_logo_intake_connected: existingBrandLogoIntakeConnected,
    contract_migration_present: contractMigrationPresent,
    preserved_event_r2_objects: eventKeys.length,
    preserved_event_r2_ready: eventR2Ready,
    organizations_without_primary_brand: organizationsWithoutPrimaryBrand,
    brands_without_kind: brandsWithoutKind,
  });

  const blockers = {
    contract_not_final: !contractMigrationPresent,
    publications_not_cut_over: !publicationManagementConnected,
    product_cm_not_cut_over:
      !productCmPipelineConnected ||
      productCmPinnedVoices !== productCmTakes.length ||
      productCmReadyOutputs !== productCmTakes.length,
    logo_presentation_not_cut_over:
      !logoPresentationPipelineConnected || !existingBrandLogoIntakeConnected,
    preserved_event_incomplete:
      eventResult.data?.length !== 1 ||
      event?.status !== "ready" ||
      eventInputs.length !== 13 ||
      eventRenders.length !== 1 ||
      eventRenders[0]?.status !== "ready" ||
      !eventR2Ready,
    organizations_without_primary_brand: organizationsWithoutPrimaryBrand > 0,
    brands_without_kind: brandsWithoutKind > 0,
    production_template_drift: templateDrift.length > 0,
  };

  console.log("\ncutover blockers");
  console.table(blockers);
  if (templateDrift.length > 0) {
    console.log(`\nproduction template drift: ${templateDrift.join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
