"use client";

// Workflow Lab — catalog page root.
// Phase 1 of the brand-visual pipeline: pre-built stage templates +
// deterministic composition. The bar is the same as every lab: does the
// logo itself look dignified? The logo is never touched by generative AI.
//
// Page skeleton (header / explainer / logo rail / logo-driven content)
// comes from the shared LabShell: pick a logo, every template below
// recomposes with it.

import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  type TemplateCategory,
} from "@/labs/workflow/core/template-format";
import {
  WORKFLOW_SCENE_NUMBER,
  WORKFLOW_SCENE_ORDER,
} from "@/labs/workflow/core/presentation-placement";
import {
  buildWorkflowCatalog,
  filterWorkflowCatalogByScene,
  isWorkflowCatalogBroken,
} from "@/labs/workflow/core/catalog";
import { comparePresentationMockups } from "@/lib/presentation-mockups";
import { fetchCatalog } from "@/labs/workflow/core/client";
import LabShell from "@/labs/shared/components/LabShell";
import FilterChips from "@/labs/shared/components/FilterChips";
import { useI18n } from "@/lib/i18n";
import type { PresentationScene } from "@/lib/presentation-scenes";
import { SectionIntro } from "@/components/scenes/shared";
import WorkflowMockupCard from "./WorkflowMockupCard";
import CostPanel from "./CostPanel";
import ArchitectureNote from "./ArchitectureNote";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

export default function WorkflowLabApp() {
  const { dict } = useI18n();
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof fetchCatalog>> | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e: unknown) =>
        setCatalogError(e instanceof Error ? e.message : "カタログ取得に失敗"),
      );
  }, []);

  const usedCategories = useMemo(
    () => {
      const items = buildWorkflowCatalog(catalog ?? []);
      return CATEGORIES.filter((category) =>
        items.some((item) => item.definition?.templateCategory === category),
      );
    },
    [catalog],
  );

  const filteredItems = useMemo(
    () =>
      buildWorkflowCatalog(catalog ?? []).filter(
        (item) =>
          category === "all" ||
          item.definition?.templateCategory === category ||
          (!item.definition && item.template?.category === category),
      ),
    [catalog, category],
  );

  const groupedScenes = useMemo(() => {
    return WORKFLOW_SCENE_ORDER.map((scene) => ({
      scene,
      entries: filterWorkflowCatalogByScene(filteredItems, scene).sort((a, b) =>
        comparePresentationMockups(a.definition!, b.definition!),
      ),
    })).filter((group) => group.entries.length > 0);
  }, [filteredItems]);

  const brokenEntries = filteredItems.filter(isWorkflowCatalogBroken);

  return (
    <LabShell
      slug="workflow"
      explainer={<ArchitectureNote />}
      logoNote="SVG推奨。ロゴは合成のため自サーバーにのみ送信され、外部AI・外部APIには渡らない。"
    >
      {(logo) => (
        <>
          {usedCategories.length > 1 && (
            <div className="border-b border-hairline">
              <div className="mx-auto max-w-6xl px-6 md:px-10 py-3">
                <FilterChips
                  label="カテゴリ"
                  value={category}
                  onChange={(v) => setCategory(v as TemplateCategory | "all")}
                  options={usedCategories.map((c) => [c, CATEGORY_LABELS[c]])}
                />
              </div>
            </div>
          )}

          <main className="mx-auto max-w-6xl px-6 md:px-10 py-6">
            {catalogError ? (
              <p className="py-16 text-center text-sm text-red-600">{catalogError}</p>
            ) : catalog === null ? (
              <LoadingShelf />
            ) : groupedScenes.length === 0 && brokenEntries.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                このカテゴリには mockup がまだない。labs/workflow/templates/ にディレクトリを追加するか、既存定義の section / 採用フラグを見直す
              </p>
            ) : (
              <div className="space-y-12">
                {groupedScenes.map(({ scene, entries }) => (
                  <section key={scene} className="overflow-hidden rounded-[32px] border border-hairline bg-paper">
                    <SectionIntro
                      n={WORKFLOW_SCENE_NUMBER[scene]}
                      title={sceneTitle(scene, dict)}
                      lead={sceneLead(scene, dict)}
                    />
                    <div className="px-6 pb-12 md:px-12 md:pb-16">
                      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        {entries.map((entry) => (
                          <WorkflowMockupCard
                            key={entry.id}
                            logo={logo}
                            item={entry}
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                ))}

                {brokenEntries.length > 0 && (
                  <section className="rounded-[28px] border border-dashed border-red-300 bg-white p-6">
                    <div className="flex items-baseline gap-3">
                      <h2 className="font-display text-lg font-semibold text-balance">
                        要修正テンプレート
                      </h2>
                      <p className="text-sm text-ink-muted">
                        カタログから外さず表示し、テンプレート作者にその場でフィードバックを返す
                      </p>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-2">
                      {brokenEntries.map((entry) => (
                        <WorkflowMockupCard
                          key={entry.id}
                          logo={logo}
                          item={entry}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </main>

          <CostPanel refreshKey={0} />
        </>
      )}
    </LabShell>
  );
}

function sceneTitle(scene: PresentationScene, dict: ReturnType<typeof useI18n>["dict"]) {
  switch (scene) {
    case "usage":
      return dict.scenes.usage;
    case "web":
      return dict.scenes.web;
    case "social":
      return dict.scenes.social;
    case "onsite":
      return dict.scenes.onsite;
    case "merch":
      return dict.scenes.merch;
    case "generated":
      return dict.scenes.generated;
    default:
      return scene;
  }
}

function sceneLead(scene: PresentationScene, dict: ReturnType<typeof useI18n>["dict"]) {
  switch (scene) {
    case "usage":
      return dict.sections.usage.lead;
    case "web":
      return dict.sections.web.lead;
    case "social":
      return dict.sections.social.lead;
    case "onsite":
      return dict.sections.onsite.lead;
    case "merch":
      return dict.sections.merch.lead;
    case "generated":
      return dict.sections.generated.lead;
    default:
      return "";
  }
}

function LoadingShelf() {
  return (
    <div className="space-y-8">
      {[0, 1].map((section) => (
        <section
          key={section}
          className="overflow-hidden rounded-[32px] border border-hairline bg-paper"
          aria-busy="true"
        >
          <div className="px-6 pt-16 pb-10 md:px-12 md:pt-24 md:pb-14">
            <div className="h-3 w-24 animate-pulse bg-ink/8" />
            <div className="mt-6 h-12 max-w-sm animate-pulse bg-ink/8" />
            <div className="mt-6 h-5 max-w-2xl animate-pulse bg-ink/8" />
          </div>
          <div className="grid grid-cols-1 gap-6 px-6 pb-12 md:px-12 md:pb-16 xl:grid-cols-2">
            {[0, 1].map((card) => (
              <div key={card} className="rounded-[28px] border border-hairline bg-white p-4">
                <div className="aspect-[4/3] animate-pulse rounded-[20px] border border-hairline bg-ink/8" />
                <div className="mt-4 h-4 w-16 animate-pulse bg-ink/8" />
                <div className="mt-2 h-6 max-w-xs animate-pulse bg-ink/8" />
                <div className="mt-3 h-4 max-w-lg animate-pulse bg-ink/8" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
