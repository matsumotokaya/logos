"use client";

import Link from "next/link";
import LabShell from "@/labs/shared/components/LabShell";
import type { BuiltinPresentationMockup } from "@/lib/presentation-mockups";
import { useI18n } from "@/lib/i18n";
import { getPresentationPlacement } from "@/lib/presentation-schema";
import { SectionIntro } from "@/components/scenes/shared";
import BuiltinMockupArt from "@/components/mockups/BuiltinMockupArt";
import ArchitectureNote from "./ArchitectureNote";
import CostPanel from "./CostPanel";
import { WORKFLOW_SCENE_NUMBER } from "@/labs/workflow/core/presentation-placement";
import { scenePropsFromLabLogo } from "@/labs/workflow/core/scene-props";

export default function WorkflowBuiltinMockupPage({
  mockup,
}: {
  mockup: BuiltinPresentationMockup;
}) {
  const { dict } = useI18n();

  return (
    <LabShell
      slug="workflow"
      explainer={<ArchitectureNote />}
      logoNote="SVG推奨。ロゴは合成のため自サーバーにのみ送信され、外部AI・外部APIには渡らない。"
    >
      {(logo) => (
        <>
          <main className="mx-auto max-w-6xl px-6 py-6 md:px-10">
            <div className="mb-6">
              <Link
                href="/labs/workflow"
                className="text-sm text-ink-muted transition hover:text-ink"
              >
                ← Workflow Lab
              </Link>
            </div>

            <section className="overflow-hidden rounded-[32px] border border-hairline bg-paper">
              <SectionIntro
                n={WORKFLOW_SCENE_NUMBER[mockup.scene]}
                title={sceneTitle(mockup.scene, dict)}
                lead={sceneLead(mockup.scene, dict)}
              />
              <div className="border-t border-hairline px-6 py-4 md:px-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-muted">
                    {mockup.category}
                  </span>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    {mockup.presentationAdopted ? "本編採用" : "ラボのみ"}
                  </span>
                  {mockup.defaultMappings?.map((mapping) => (
                    <span
                      key={`${mockup.id}:${mapping.placementId}`}
                      className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-muted"
                    >
                      {getPresentationPlacement(mapping.placementId).label}
                    </span>
                  ))}
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold text-balance">
                  {mockup.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pretty text-ink-muted">
                  {mockup.notesJa}
                </p>
              </div>
              <div className="px-6 pb-12 md:px-12 md:pb-16">
                <div className="rounded-[28px] border border-hairline bg-white p-6">
                  <BuiltinMockupArt
                    kind={mockup.builtinKind}
                    scene={scenePropsFromLabLogo(logo)}
                    className="mx-auto max-w-3xl"
                  />
                </div>
              </div>
            </section>
          </main>

          <CostPanel refreshKey={0} />
        </>
      )}
    </LabShell>
  );
}

function sceneTitle(
  scene: BuiltinPresentationMockup["scene"],
  dict: ReturnType<typeof useI18n>["dict"],
) {
  switch (scene) {
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

function sceneLead(
  scene: BuiltinPresentationMockup["scene"],
  dict: ReturnType<typeof useI18n>["dict"],
) {
  switch (scene) {
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
