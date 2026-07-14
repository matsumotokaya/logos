"use client";

import type {
  PresentationMockupDefinition,
  ResolvedPresentationMockup,
} from "@/lib/presentation-mockups";
import Reveal from "@/components/scenes/Reveal";
import { SectionIntro, type SceneProps } from "@/components/scenes/shared";
import BuiltinMockupArt from "@/components/mockups/BuiltinMockupArt";
import WorkflowTemplateArt from "@/components/mockups/WorkflowTemplateArt";
import GeneratedMockupCard from "@/components/mockups/GeneratedMockupCard";

export default function MockupScene({
  n,
  title,
  lead,
  slug,
  scene,
  entries,
}: {
  n: string;
  title: string;
  lead: string;
  slug: string;
  scene: SceneProps;
  entries: ResolvedPresentationMockup[];
}) {
  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro n={n} title={title} lead={lead} slug={slug} />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {entries.map(({ definition, mapping, placement }) => (
            <article key={`${definition.id}:${placement.id}`}>
              {definition.kind === "builtin" ? (
                definition.builtinKind === "generated-mug" ||
                definition.builtinKind === "generated-tote" ||
                definition.builtinKind === "generated-cap" ? (
                  <>
                    <GeneratedMockupCard
                      scene={scene}
                      mockupId={definition.id as "mug" | "tote" | "cap"}
                      label={definition.title}
                    />
                    <Caption
                      entry={definition}
                      mappingOrder={mapping.order}
                      placementLabel={placement.label}
                    />
                  </>
                ) : (
                  <>
                    <BuiltinMockupArt
                      kind={definition.builtinKind}
                      scene={scene}
                      className="flex h-full flex-col justify-center"
                    />
                    <Caption
                      entry={definition}
                      mappingOrder={mapping.order}
                      placementLabel={placement.label}
                    />
                  </>
                )
              ) : (
                <>
                  <WorkflowTemplateArt
                    templateId={definition.template.id}
                    scene={scene}
                  />
                  <Caption
                    entry={definition}
                    mappingOrder={mapping.order}
                    placementLabel={placement.label}
                  />
                </>
              )}
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Caption({
  entry,
  mappingOrder,
  placementLabel,
}: {
  entry: PresentationMockupDefinition;
  mappingOrder: number;
  placementLabel: string;
}) {
  return (
    <div className="mt-3">
      <p className="font-mono text-[10px] uppercase text-ink-muted">
        {entry.sourceLab} · {placementLabel} · {String(mappingOrder).padStart(2, "0")}
      </p>
      <p className="mt-1 text-sm font-medium text-ink">{entry.title}</p>
      {entry.notesJa ? (
        <p className="mt-1 text-sm leading-relaxed text-pretty text-ink-muted">
          {entry.notesJa}
        </p>
      ) : null}
    </div>
  );
}
