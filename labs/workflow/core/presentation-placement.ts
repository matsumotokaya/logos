import type {
  Template2D,
  TemplateCategory,
} from "./template-format";
import type {
  PresentationAssetMappingSpec,
  PresentationPlacementId,
} from "@/lib/presentation-schema";
import { getPresentationPlacement } from "@/lib/presentation-schema";
import type { PresentationScene } from "@/lib/presentation-scenes";

export const WORKFLOW_SCENE_ORDER: PresentationScene[] = [
  "usage",
  "web",
  "social",
  "onsite",
  "merch",
  "generated",
];

export const WORKFLOW_SCENE_NUMBER: Record<PresentationScene, string> = {
  identity: "01",
  construction: "02",
  color: "03",
  usage: "04",
  appIcon: "05",
  web: "06",
  social: "07",
  onsite: "08",
  merch: "09",
  generated: "10",
};

const DEFAULT_SCENE_BY_CATEGORY: Record<TemplateCategory, PresentationScene> = {
  print: "merch",
  fabric: "merch",
  signage: "onsite",
  screen: "web",
  product: "merch",
};

export function getWorkflowPresentationScene(
  template: Pick<
    Template2D,
    "category" | "presentation" | "presentationScene" | "presentationAdopted" | "presentationOrder"
  >,
): PresentationScene {
  const firstDefaultMapping = getWorkflowDefaultMappings(template)[0];
  if (firstDefaultMapping) {
    return getPresentationPlacement(firstDefaultMapping.placementId).scene;
  }
  return getLegacyWorkflowPresentationScene(template);
}

export function getWorkflowPresentationPlacements(
  template: Pick<Template2D, "category" | "presentation" | "presentationScene">,
) {
  if (template.presentation?.allowedPlacements?.length) {
    return template.presentation.allowedPlacements;
  }
  return [placementIdForScene(getLegacyWorkflowPresentationScene(template))];
}

export function getWorkflowDefaultMappings(
  template: Pick<
    Template2D,
    | "category"
    | "presentation"
    | "presentationScene"
    | "presentationAdopted"
    | "presentationOrder"
  >,
): PresentationAssetMappingSpec[] {
  if (template.presentation?.defaultMappings?.length) {
    return template.presentation.defaultMappings;
  }
  return [
    {
      placementId: placementIdForScene(getLegacyWorkflowPresentationScene(template)),
      order: template.presentationOrder ?? Number.MAX_SAFE_INTEGER,
      enabled: template.presentationAdopted ?? false,
    },
  ];
}

export function comparePresentationTemplates(a: Template2D, b: Template2D) {
  const firstOrder = (template: Template2D) =>
    getWorkflowDefaultMappings(template).reduce(
      (min, mapping) => Math.min(min, mapping.order),
      Number.MAX_SAFE_INTEGER,
    );
  return firstOrder(a) - firstOrder(b) || a.nameJa.localeCompare(b.nameJa, "ja");
}

function placementIdForScene(scene: PresentationScene): PresentationPlacementId {
  switch (scene) {
    case "social":
      return "social.primary";
    case "onsite":
      return "onsite.primary";
    case "generated":
      return "generated.tile";
    case "identity":
      return "splash.hero";
    case "construction":
    case "color":
    case "usage":
    case "appIcon":
    case "web":
    case "merch":
    default:
      return "merch.primary";
  }
}

function getLegacyWorkflowPresentationScene(
  template: Pick<Template2D, "category" | "presentationScene">,
): PresentationScene {
  return template.presentationScene ?? DEFAULT_SCENE_BY_CATEGORY[template.category];
}
