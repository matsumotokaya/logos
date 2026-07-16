import type { CatalogEntryDto } from "@/labs/workflow/core/pipeline";
import {
  CODE_PRESENTATION_MOCKUPS,
  type PresentationMockupDefinition,
  templateToPresentationMockup,
} from "@/lib/presentation-mockups";
import { isProductionAssetDefinition } from "@/lib/presentation-schema";

export type BrokenPresentationCatalogItem = {
  id: string;
  errors: string[];
};

export type PresentationCatalogResponse = {
  definitions: PresentationMockupDefinition[];
  brokenItems: BrokenPresentationCatalogItem[];
};

export function buildPresentationCatalog(
  workflowCatalog: CatalogEntryDto[],
): PresentationCatalogResponse {
  return {
    definitions: buildPresentationDefinitions(workflowCatalog).filter(
      isProductionAssetDefinition,
    ),
    brokenItems: workflowCatalog
      .filter((entry) => !entry.template || entry.errors.length > 0)
      .map((entry) => ({
        id: entry.id,
        errors: entry.errors,
      })),
  };
}

export function buildPresentationDefinitions(
  workflowCatalog: CatalogEntryDto[],
): PresentationMockupDefinition[] {
  const workflowDefinitions = workflowCatalog
    .filter((entry) => entry.template && entry.errors.length === 0)
    .map((entry) => templateToPresentationMockup(entry.template!));
  return [...CODE_PRESENTATION_MOCKUPS, ...workflowDefinitions];
}

export async function fetchPresentationCatalog() {
  const res = await fetch("/api/presentation-assets");
  if (!res.ok) throw new Error(`プレゼン資産取得に失敗 (${res.status})`);
  return (await res.json()) as PresentationCatalogResponse;
}
