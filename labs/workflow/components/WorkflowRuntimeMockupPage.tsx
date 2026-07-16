"use client";

import Link from "next/link";
import RuntimeMockupCard from "@/components/mockups/RuntimeMockupCard";
import { SectionIntro } from "@/components/scenes/shared";
import LabShell from "@/labs/shared/components/LabShell";
import { WORKFLOW_SCENE_NUMBER } from "@/labs/workflow/core/presentation-placement";
import { scenePropsFromLabLogo } from "@/labs/workflow/core/scene-props";
import type { RuntimePresentationMockup } from "@/lib/presentation-mockups";
import {
  getPresentationPlacement,
  PRESENTATION_ASSET_RELEASE_LABELS,
} from "@/lib/presentation-schema";
import ArchitectureNote from "./ArchitectureNote";

export default function WorkflowRuntimeMockupPage({
  mockup,
}: {
  mockup: RuntimePresentationMockup;
}) {
  return (
    <LabShell
      slug="workflow"
      explainer={<ArchitectureNote />}
      logoNote="正本SVGをランタイムワーカーへ渡し、生成結果はロゴ候補単位で保存する。"
    >
      {(logo) => {
        const scene = scenePropsFromLabLogo(logo);
        return (
          <main className="mx-auto max-w-6xl px-6 py-6 md:px-10">
            <div className="mb-6">
              <Link
                href="/labs/workflow"
                className="text-sm text-ink-muted transition-colors hover:text-ink"
              >
                ← Workflow Lab
              </Link>
            </div>

            <section className="overflow-hidden rounded-lg border border-hairline bg-paper">
              <SectionIntro
                n={WORKFLOW_SCENE_NUMBER[mockup.scene]}
                title={mockup.title}
                lead={mockup.notesJa}
              />

              <div className="border-t border-hairline px-6 py-4 md:px-12">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-dashed border-ink-faint px-2 py-0.5 text-ink-muted">
                    {PRESENTATION_ASSET_RELEASE_LABELS[mockup.releaseStage]}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-ink-muted">
                    {mockup.rendererKind}
                  </span>
                  <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-ink-muted">
                    v{mockup.version}
                  </span>
                  {mockup.allowedPlacements.map((placementId) => (
                    <span
                      key={placementId}
                      className="rounded-full border border-hairline px-2 py-0.5 text-ink-muted"
                    >
                      {getPresentationPlacement(placementId).label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid min-w-0 gap-8 px-6 pb-12 md:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)] md:px-12 md:pb-16">
                <RuntimeMockupCard
                  scene={scene}
                  assetId={mockup.id}
                  label={mockup.title}
                  requestDetails={{
                    familyId: mockup.familyId,
                    version: mockup.version,
                    params: { colorMode: "logo" },
                  }}
                />

                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase text-accent">
                    Internal production note
                  </p>
                  <dl className="mt-4 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                    <dt className="text-ink-muted">Family</dt>
                    <dd className="font-mono text-xs text-ink">{mockup.familyId}</dd>
                    <dt className="text-ink-muted">Worker</dt>
                    <dd className="text-ink">{mockup.runtime.worker}</dd>
                    <dt className="text-ink-muted">Estimated</dt>
                    <dd className="tabular-nums text-ink">
                      約{Math.round(mockup.runtime.estimatedSeconds / 60)}分 / logo
                    </dd>
                    <dt className="text-ink-muted">Script</dt>
                    <dd className="min-w-0 break-all font-mono text-xs text-ink">
                      {mockup.runtime.script}
                    </dd>
                  </dl>

                  <div className="mt-6 border-t border-hairline pt-5">
                    <p className="text-sm font-medium text-ink">Headless reproduction</p>
                    <code className="mt-3 block max-w-full overflow-x-auto bg-ink px-4 py-3 font-mono text-xs leading-relaxed whitespace-nowrap text-white">
                      {`Blender -b -P ${mockup.runtime.script} -- --svg <master.svg> --out <render.png> --color-mode <logo|warm-white>`}
                    </code>
                  </div>
                </div>
              </div>
            </section>
          </main>
        );
      }}
    </LabShell>
  );
}
