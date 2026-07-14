import {
  BUILTIN_PRESENTATION_MOCKUPS,
  type PresentationMockupDefinition,
  templateToPresentationMockup,
} from "@/lib/presentation-mockups";
import { getPresentationPlacement } from "@/lib/presentation-schema";
import type { PresentationScene } from "@/lib/presentation-scenes";
import type { CatalogEntryDto } from "./pipeline";
import type { Template2D } from "./template-format";

export type WorkflowCatalogItem = {
  id: string;
  definition?: PresentationMockupDefinition;
  template?: Template2D;
  errors: string[];
};

export function buildWorkflowCatalog(catalog: CatalogEntryDto[]): WorkflowCatalogItem[] {
  const builtinItems: WorkflowCatalogItem[] = BUILTIN_PRESENTATION_MOCKUPS.filter(
    (entry) => entry.sourceLab === "workflow",
  ).map((entry) => ({
    id: entry.id,
    definition: entry,
    errors: [],
  }));

  const templateItems: WorkflowCatalogItem[] = catalog.map((entry) =>
    entry.template
      ? {
          id: entry.id,
          definition: templateToPresentationMockup(entry.template),
          template: entry.template,
          errors: entry.errors,
        }
      : {
          id: entry.id,
          errors: entry.errors,
        },
  );

  return [...builtinItems, ...templateItems];
}

export function filterWorkflowCatalogByScene(
  items: WorkflowCatalogItem[],
  scene: PresentationScene,
) {
  return items.filter((item) =>
    item.definition?.allowedPlacements.some(
      (placementId) => getPresentationPlacement(placementId).scene === scene,
    ),
  );
}

export function isWorkflowCatalogBroken(item: WorkflowCatalogItem) {
  return item.errors.length > 0 || !item.definition;
}
