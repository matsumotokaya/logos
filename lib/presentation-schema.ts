import type { PresentationScene } from "@/lib/presentation-scenes";

export type PresentationSourceLab = "motion" | "workflow" | "generative";
export type PresentationAssetKind = "motion" | "mockup" | "generated";
export type PresentationAssetReleaseStage = "draft" | "production";

export const PRESENTATION_ASSET_RELEASE_LABELS: Record<
  PresentationAssetReleaseStage,
  string
> = {
  draft: "Draft",
  production: "Production",
};

export type PresentationPlacementId =
  | "splash.hero"
  | "social.primary"
  | "onsite.primary"
  | "merch.primary"
  | "generated.tile";

export type PresentationPlacement = {
  id: PresentationPlacementId;
  scene: PresentationScene;
  label: string;
  multiple: boolean;
};

export const PRESENTATION_PLACEMENTS: Record<
  PresentationPlacementId,
  PresentationPlacement
> = {
  "splash.hero": {
    id: "splash.hero",
    scene: "identity",
    label: "Splash hero",
    multiple: false,
  },
  "social.primary": {
    id: "social.primary",
    scene: "social",
    label: "Social primary",
    multiple: true,
  },
  "onsite.primary": {
    id: "onsite.primary",
    scene: "onsite",
    label: "On-site primary",
    multiple: true,
  },
  "merch.primary": {
    id: "merch.primary",
    scene: "merch",
    label: "Merch primary",
    multiple: true,
  },
  "generated.tile": {
    id: "generated.tile",
    scene: "generated",
    label: "Generated tile",
    multiple: true,
  },
};

const PRESENTATION_PLACEMENT_ORDER: PresentationPlacementId[] = [
  "splash.hero",
  "social.primary",
  "onsite.primary",
  "merch.primary",
  "generated.tile",
];

export type PresentationAssetMapping = {
  assetId: string;
  placementId: PresentationPlacementId;
  order: number;
  enabled: boolean;
  params?: Record<string, unknown>;
};

export type PresentationAssetMappingSpec = Omit<
  PresentationAssetMapping,
  "assetId"
>;

export type PresentationLayout = {
  version: 1;
  mappings: PresentationAssetMapping[];
};

export function emptyPresentationLayout(): PresentationLayout {
  return {
    version: 1,
    mappings: [],
  };
}

export type PresentationAssetDefinitionCommon = {
  id: string;
  familyId: string;
  version: number;
  releaseStage: PresentationAssetReleaseStage;
  assetKind: PresentationAssetKind;
  sourceLab: PresentationSourceLab;
  rendererKind: string;
  title: string;
  notesJa: string;
  impressions?: string[];
  allowedPlacements: PresentationPlacementId[];
  defaultMappings?: PresentationAssetMappingSpec[];
  config?: Record<string, unknown>;
};

export type ResolvedPresentationAsset<T> = {
  definition: T;
  mapping: PresentationAssetMapping;
  placement: PresentationPlacement;
};

export function resolvePresentationAssets<
  T extends PresentationAssetDefinitionCommon,
>(definitions: T[], layout: PresentationLayout): ResolvedPresentationAsset<T>[] {
  const productionDefinitions = definitions.filter(isProductionAssetDefinition);
  const byId = new Map<string, T>(
    productionDefinitions.map((definition) => [definition.id, definition]),
  );
  const resolved = new Map<string, PresentationAssetMapping>();

  for (const definition of productionDefinitions) {
    for (const mapping of definition.defaultMappings ?? []) {
      if (!definition.allowedPlacements.includes(mapping.placementId)) continue;
      resolved.set(presentationMappingKey(definition.id, mapping.placementId), {
        assetId: definition.id,
        ...mapping,
      });
    }
  }

  for (const mapping of layout.mappings) {
    const definition = byId.get(mapping.assetId);
    if (!definition) continue;
    if (!definition.allowedPlacements.includes(mapping.placementId)) continue;
    resolved.set(presentationMappingKey(mapping.assetId, mapping.placementId), mapping);
  }

  return [...resolved.values()]
    .filter((mapping) => mapping.enabled)
    .sort((a, b) => {
      return (
        presentationPlacementRank(a.placementId) -
          presentationPlacementRank(b.placementId) ||
        a.order - b.order ||
        a.assetId.localeCompare(b.assetId)
      );
    })
    .flatMap((mapping) => {
      const definition = byId.get(mapping.assetId);
      const placement = getPresentationPlacement(mapping.placementId);
      return definition ? [{ definition, mapping, placement }] : [];
    });
}

export type PresentationPlacementCatalogEntry<T> = {
  placement: PresentationPlacement;
  selected: ResolvedPresentationAsset<T>[];
  available: T[];
};

export function buildPlacementCatalog<T extends PresentationAssetDefinitionCommon>(
  definitions: T[],
  layout: PresentationLayout,
): PresentationPlacementCatalogEntry<T>[] {
  const productionDefinitions = definitions.filter(isProductionAssetDefinition);
  const selected = resolvePresentationAssets(productionDefinitions, layout);
  return PRESENTATION_PLACEMENT_ORDER.map((placementId) => {
    const placement = getPresentationPlacement(placementId);
    return {
      placement,
      selected: selected.filter((entry) => entry.placement.id === placement.id),
      available: productionDefinitions.filter((definition) =>
        definition.allowedPlacements.includes(placement.id),
      ),
    };
  });
}

export function buildEditablePresentationLayout<
  T extends PresentationAssetDefinitionCommon,
>(definitions: T[], layout: PresentationLayout): PresentationLayout {
  const productionDefinitions = definitions.filter(isProductionAssetDefinition);
  const byId = new Map<string, T>(
    productionDefinitions.map((definition) => [definition.id, definition]),
  );
  const explicit = new Map<string, PresentationAssetMapping>();

  productionDefinitions.forEach((definition, definitionIndex) => {
    definition.allowedPlacements.forEach((placementId, placementIndex) => {
      const defaultMapping = definition.defaultMappings?.find(
        (mapping) => mapping.placementId === placementId,
      );
      explicit.set(presentationMappingKey(definition.id, placementId), {
        assetId: definition.id,
        placementId,
        order:
          defaultMapping?.order ??
          placementFallbackOrder(definitionIndex, placementIndex),
        enabled: defaultMapping?.enabled ?? false,
        params: defaultMapping?.params,
      });
    });
  });

  layout.mappings.forEach((mapping) => {
    const definition = byId.get(mapping.assetId);
    if (!definition) return;
    if (!definition.allowedPlacements.includes(mapping.placementId)) return;
    explicit.set(
      presentationMappingKey(mapping.assetId, mapping.placementId),
      mapping,
    );
  });

  return normalizePresentationLayout({
    version: 1,
    mappings: [...explicit.values()],
  });
}

export function isProductionAssetDefinition<
  T extends PresentationAssetDefinitionCommon,
>(definition: T): definition is T & { releaseStage: "production" } {
  return definition.releaseStage === "production";
}

export function presentationMappingKey(assetId: string, placementId: PresentationPlacementId) {
  return `${assetId}:${placementId}`;
}

export function getPresentationPlacement(
  placementId: PresentationPlacementId,
): PresentationPlacement {
  return PRESENTATION_PLACEMENTS[placementId];
}

export function isPresentationPlacementId(
  value: unknown,
): value is PresentationPlacementId {
  return typeof value === "string" && value in PRESENTATION_PLACEMENTS;
}

export function normalizePresentationLayout(
  raw: Partial<PresentationLayout> | null | undefined,
): PresentationLayout {
  const mappings = Array.isArray(raw?.mappings)
    ? raw.mappings.flatMap((mapping) =>
        isPresentationAssetMapping(mapping) ? [mapping] : [],
      )
    : [];

  return {
    version: 1,
    mappings,
  };
}

function isPresentationAssetMapping(value: unknown): value is PresentationAssetMapping {
  if (typeof value !== "object" || value === null) return false;
  const mapping = value as Record<string, unknown>;
  return (
    typeof mapping.assetId === "string" &&
    isPresentationPlacementId(mapping.placementId) &&
    typeof mapping.order === "number" &&
    Number.isFinite(mapping.order) &&
    typeof mapping.enabled === "boolean" &&
    (mapping.params === undefined ||
      (typeof mapping.params === "object" &&
        mapping.params !== null &&
        !Array.isArray(mapping.params)))
  );
}

function presentationPlacementRank(placementId: PresentationPlacementId) {
  const index = PRESENTATION_PLACEMENT_ORDER.indexOf(placementId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function placementFallbackOrder(
  definitionIndex: number,
  placementIndex: number,
) {
  return 1000 + definitionIndex * 10 + placementIndex;
}
