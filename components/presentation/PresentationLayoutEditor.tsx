"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { PresentationMockupDefinition } from "@/lib/presentation-mockups";
import {
  buildEditablePresentationLayout,
  buildPlacementCatalog,
  presentationMappingKey,
  type PresentationAssetMapping,
  type PresentationLayout,
} from "@/lib/presentation-schema";

const COPY = {
  title: "Presentation Mapping",
  description:
    "Choose which lab assets are adopted into each presentation placement. This is the same structure the end-user customizer will use later.",
  noAssets: "No assets available for this placement yet.",
  selected: "Selected",
  notSelected: "Not selected",
  enable: "Enable",
  disable: "Disable",
  moveUp: "Move up",
  moveDown: "Move down",
  multiple: "Multiple selection",
  single: "Single selection",
};

export default function PresentationLayoutEditor({
  definitions,
  layout,
  onSaveLayout,
}: {
  definitions: PresentationMockupDefinition[];
  layout: PresentationLayout;
  onSaveLayout: (layout: PresentationLayout) => void;
}) {
  const editableLayout = useMemo(
    () => buildEditablePresentationLayout(definitions, layout),
    [definitions, layout],
  );

  const placementCatalog = useMemo(
    () => buildPlacementCatalog(definitions, editableLayout),
    [definitions, editableLayout],
  );

  const mappingByKey = useMemo(
    () =>
      new Map(
        editableLayout.mappings.map((mapping) => [
          presentationMappingKey(mapping.assetId, mapping.placementId),
          mapping,
        ]),
      ),
    [editableLayout.mappings],
  );

  const saveMappings = (nextMappings: PresentationAssetMapping[]) => {
    onSaveLayout({
      version: 1,
      mappings: nextMappings,
    });
  };

  const toggleMapping = (
    placementId: string,
    assetId: string,
    enabled: boolean,
    multiple: boolean,
  ) => {
    const next = editableLayout.mappings.map((mapping) => {
      if (mapping.placementId !== placementId) return mapping;
      if (mapping.assetId === assetId) {
        return {
          ...mapping,
          enabled,
          order: enabled ? nextOrderForPlacement(editableLayout.mappings, placementId) : mapping.order,
        };
      }
      if (!multiple && enabled) {
        return { ...mapping, enabled: false };
      }
      return mapping;
    });
    saveMappings(resequencePlacement(next, placementId));
  };

  const moveMapping = (
    placementId: string,
    assetId: string,
    direction: "up" | "down",
  ) => {
    const group = editableLayout.mappings
      .filter((mapping) => mapping.placementId === placementId && mapping.enabled)
      .sort((a, b) => a.order - b.order);
    const index = group.findIndex((mapping) => mapping.assetId === assetId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= group.length) return;

    const reordered = [...group];
    const [current] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, current);

    const next = editableLayout.mappings.map((mapping) => {
      if (mapping.placementId !== placementId || !mapping.enabled) return mapping;
      const orderIndex = reordered.findIndex((entry) => entry.assetId === mapping.assetId);
      return orderIndex === -1
        ? mapping
        : { ...mapping, order: (orderIndex + 1) * 10 };
    });

    saveMappings(next);
  };

  return (
    <section className="border-b border-hairline bg-white">
      <div className="mx-auto max-w-7xl px-6 py-6 md:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase text-accent">{COPY.title}</p>
          <h2 className="mt-3 font-display text-2xl font-semibold text-balance md:text-3xl">
            Compose the presentation
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-ink-muted">
            {COPY.description}
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {placementCatalog.map(({ placement, selected, available }) => (
            <section
              key={placement.id}
              className="rounded-[24px] border border-hairline bg-paper p-4 md:p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[11px] uppercase text-accent">
                  {placement.label}
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-ink-muted">
                  Scene {placement.scene}
                </span>
                <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
                  {placement.multiple ? COPY.multiple : COPY.single}
                </span>
              </div>

              {available.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">{COPY.noAssets}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {available.map((definition) => {
                    const mapping = mappingByKey.get(
                      presentationMappingKey(definition.id, placement.id),
                    );
                    const isSelected = mapping?.enabled ?? false;
                    const order =
                      selected.findIndex((entry) => entry.definition.id === definition.id) + 1;
                    return (
                      <article
                        key={`${placement.id}:${definition.id}`}
                        className={cn(
                          "rounded-[20px] border p-4 transition-colors",
                          isSelected
                            ? "border-accent bg-white"
                            : "border-hairline bg-white/70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-ink">
                                {definition.title}
                              </h3>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px]",
                                  isSelected
                                    ? "bg-accent/10 text-accent"
                                    : "bg-ink/5 text-ink-muted",
                                )}
                              >
                                {isSelected ? COPY.selected : COPY.notSelected}
                              </span>
                              <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
                                {definition.sourceLab}
                              </span>
                              {isSelected && (
                                <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
                                  #{order}
                                </span>
                              )}
                            </div>
                            {definition.notesJa && (
                              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-pretty text-ink-muted">
                                {definition.notesJa}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                toggleMapping(
                                  placement.id,
                                  definition.id,
                                  !isSelected,
                                  placement.multiple,
                                )
                              }
                              className={cn(
                                "border px-3 py-1.5 text-xs font-medium transition-colors",
                                isSelected
                                  ? "border-accent bg-accent text-white"
                                  : "border-hairline text-ink-muted hover:border-ink hover:text-ink",
                              )}
                            >
                              {isSelected ? COPY.disable : COPY.enable}
                            </button>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => moveMapping(placement.id, definition.id, "up")}
                              className="border border-hairline px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
                            >
                              {COPY.moveUp}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMapping(placement.id, definition.id, "down")}
                              className="border border-hairline px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
                            >
                              {COPY.moveDown}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function nextOrderForPlacement(
  mappings: PresentationAssetMapping[],
  placementId: string,
) {
  const max = mappings
    .filter((mapping) => mapping.placementId === placementId && mapping.enabled)
    .reduce((acc, mapping) => Math.max(acc, mapping.order), 0);
  return max + 10;
}

function resequencePlacement(
  mappings: PresentationAssetMapping[],
  placementId: string,
) {
  const enabled = mappings
    .filter((mapping) => mapping.placementId === placementId && mapping.enabled)
    .sort((a, b) => a.order - b.order)
    .map((mapping, index) => ({ ...mapping, order: (index + 1) * 10 }));

  const enabledByAssetId = new Map(enabled.map((mapping) => [mapping.assetId, mapping]));
  return mappings.map((mapping) =>
    mapping.placementId === placementId && mapping.enabled
      ? (enabledByAssetId.get(mapping.assetId) ?? mapping)
      : mapping,
  );
}
