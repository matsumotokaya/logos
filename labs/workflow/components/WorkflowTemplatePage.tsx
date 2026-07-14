"use client";

import Link from "next/link";
import LabShell from "@/labs/shared/components/LabShell";
import type { Template2D } from "@/labs/workflow/core/template-format";
import {
  getWorkflowPresentationScene,
  WORKFLOW_SCENE_NUMBER,
} from "@/labs/workflow/core/presentation-placement";
import { getPresentationPlacement } from "@/lib/presentation-schema";
import { templateToPresentationMockup } from "@/lib/presentation-mockups";
import { useI18n } from "@/lib/i18n";
import { SectionIntro } from "@/components/scenes/shared";
import ArchitectureNote from "./ArchitectureNote";
import CostPanel from "./CostPanel";
import WorkflowTemplateInspector from "./WorkflowTemplateInspector";
import { useState } from "react";

export default function WorkflowTemplatePage({
  template,
}: {
  template: Template2D;
}) {
  const { dict } = useI18n();
  const [jobTick, setJobTick] = useState(0);
  const scene = getWorkflowPresentationScene(template);
  const definition = templateToPresentationMockup(template);

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
                n={WORKFLOW_SCENE_NUMBER[scene]}
                title={sceneTitle(scene, dict)}
                lead={sceneLead(scene, dict)}
              />
              <div className="border-t border-hairline px-6 py-4 md:px-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-muted">
                    {definition.category}
                  </span>
                  <span
                    className={
                      definition.presentationAdopted
                        ? "rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent"
                        : "rounded-full border border-dashed border-ink-faint px-2 py-0.5 text-[11px] text-ink-faint"
                    }
                  >
                    {definition.presentationAdopted ? "本編採用" : "ラボのみ"}
                  </span>
                  {definition.defaultMappings?.map((mapping) => (
                    <span
                      key={`${definition.id}:${mapping.placementId}`}
                      className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-muted"
                    >
                      {getPresentationPlacement(mapping.placementId).label}
                    </span>
                  ))}
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-pretty text-ink-muted">
                  このテンプレートはプレゼンテーション本編の
                  <strong className="font-medium text-ink"> {sceneTitle(scene, dict)} </strong>
                  セクションに、そのまま取り込む前提で設計する。ここでは選択中のロゴで最終形に近い状態を確認し、配置・色処理・技術要件・採用判断を詰める。
                </p>
              </div>
              <div className="px-6 pb-12 md:px-12 md:pb-16">
                <WorkflowTemplateInspector
                  template={template}
                  logo={logo}
                  onComposed={() => setJobTick((n) => n + 1)}
                />
              </div>
            </section>
          </main>

          <CostPanel refreshKey={jobTick} />
        </>
      )}
    </LabShell>
  );
}

function sceneTitle(
  scene: ReturnType<typeof getWorkflowPresentationScene>,
  dict: ReturnType<typeof useI18n>["dict"],
) {
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

function sceneLead(
  scene: ReturnType<typeof getWorkflowPresentationScene>,
  dict: ReturnType<typeof useI18n>["dict"],
) {
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
