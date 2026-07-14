"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import BuiltinMockupArt from "@/components/mockups/BuiltinMockupArt";
import WorkflowTemplateArt from "@/components/mockups/WorkflowTemplateArt";
import { cn } from "@/lib/cn";
import { getPresentationPlacement } from "@/lib/presentation-schema";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import {
  getNotesSnapshot,
  getServerNotesSnapshot,
  subscribeNotes,
} from "@/labs/motion/core/notes-store";
import type { WorkflowCatalogItem } from "@/labs/workflow/core/catalog";
import { scenePropsFromLabLogo } from "@/labs/workflow/core/scene-props";
import { noteKey } from "./TemplateCard";

export default function WorkflowMockupCard({
  item,
  logo,
}: {
  item: WorkflowCatalogItem;
  logo: LabLogo;
}) {
  const note = useSyncExternalStore(
    subscribeNotes,
    () => getNotesSnapshot()[noteKey(item.id)],
    () => getServerNotesSnapshot()[noteKey(item.id)],
  );
  const scene = scenePropsFromLabLogo(logo);

  if (!item.definition) {
    return (
      <article className="rounded-[28px] border border-dashed border-red-300 bg-white p-4">
        <p className="font-mono text-[11px] text-red-500">{item.id}</p>
        {item.errors.map((error) => (
          <p key={error} className="mt-2 font-mono text-[10px] leading-relaxed text-red-600">
            {error}
          </p>
        ))}
      </article>
    );
  }

  const definition = item.definition;
  const content = (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[28px] border border-hairline bg-white p-3 md:p-4",
        "transition group-hover:border-ink-faint group-hover:shadow-sm",
      )}
    >
      {definition.kind === "builtin" ? (
        <BuiltinMockupArt
          kind={definition.builtinKind}
          scene={scene}
          className="flex min-h-[20rem] flex-col justify-center"
        />
      ) : (
        <WorkflowTemplateArt
          templateId={definition.template.id}
          scene={scene}
          showMetrics
        />
      )}

      <div className="flex flex-1 flex-col gap-3 px-1 pb-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] text-ink-faint">{item.id}</p>
            <h3 className="mt-1 text-base font-semibold text-balance">
              {definition.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-pretty text-ink-muted">
              {definition.notesJa}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {note?.rating ? (
              <span className="block text-[11px] text-accent">
                {"★".repeat(note.rating)}
              </span>
            ) : null}
            <span className="mt-2 block text-xs text-accent">詳細を見る →</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
          <span className="rounded-full bg-ink/5 px-2 py-0.5">
            {definition.category}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              definition.presentationAdopted
                ? "bg-accent/10 text-accent"
                : "border border-dashed border-ink-faint text-ink-faint",
            )}
          >
            {definition.presentationAdopted ? "本編採用" : "ラボのみ"}
          </span>
          {definition.defaultMappings?.map((mapping) => (
            <span
              key={`${definition.id}:${mapping.placementId}`}
              className="rounded-full border border-hairline px-2 py-0.5"
            >
              {getPresentationPlacement(mapping.placementId).label}
            </span>
          ))}
          {(definition.impressions ?? []).map((tag) => (
            <span key={tag} className="rounded-full px-1 py-0.5">
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );

  return (
    <Link
      href={`/labs/workflow/${item.id}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}
