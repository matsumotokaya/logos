"use client";

// Catalog card for one art direction. Unlike the Workflow Lab, nothing
// auto-generates on logo switch — exploration costs real money, so every
// generation is an explicit click inside the modal. The card shows the
// template's declaration (taxonomy, engine, dials, supported logo types)
// and the most recent generation for it, if any.

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  getNotesSnapshot,
  getServerNotesSnapshot,
  subscribeNotes,
} from "@/labs/motion/core/notes-store";
import {
  DIAL_AXES,
  DIAL_LABELS,
  LOGO_TYPE_LABELS,
  TAXONOMY_LABELS,
} from "@/labs/generative/core/expression-format";
import type {
  EngineStatusDto,
  ExpressionCatalogEntry,
  RecentGenJob,
} from "@/labs/generative/core/api-types";
import { resolveDials } from "@/labs/generative/core/dials";

export const noteKey = (templateId: string) => `gen:${templateId}`;

export default function ExpressionCard({
  entry,
  engines,
  latest,
  onOpen,
}: {
  entry: ExpressionCatalogEntry;
  engines: EngineStatusDto[];
  latest?: RecentGenJob;
  onOpen: (id: string) => void;
}) {
  const { id, template, errors } = entry;
  const broken = !template || errors.length > 0;

  const note = useSyncExternalStore(
    subscribeNotes,
    () => getNotesSnapshot()[noteKey(id)],
    () => getServerNotesSnapshot()[noteKey(id)],
  );

  const engine = template
    ? engines.find((e) => e.id === template.engine)
    : undefined;
  const balanced = template ? resolveDials("balanced", template) : null;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-hairline bg-white transition",
        !broken && "cursor-pointer hover:border-ink-faint hover:shadow-sm",
      )}
      onClick={() => !broken && onOpen(id)}
    >
      <div className="relative aspect-[16/10] border-b border-hairline bg-paper">
        {broken ? (
          <div className="flex h-full flex-col items-start justify-center gap-1 overflow-auto p-4">
            <span className="rounded-full border border-dashed border-red-300 px-2.5 py-0.5 text-[10px] text-red-500">
              テンプレート不正
            </span>
            {errors.map((e) => (
              <p key={e} className="font-mono text-[10px] leading-relaxed text-red-600">
                {e}
              </p>
            ))}
          </div>
        ) : latest ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={latest.outputUrl}
              alt={template.nameJa}
              className="h-full w-full object-cover"
            />
            <span className="absolute right-2 bottom-2 rounded-full bg-ink/60 px-2 py-0.5 text-[10px] text-white">
              {latest.mock ? "モック" : latest.engineUsed} / 直近の生成
            </span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-[13px] leading-relaxed text-ink-muted">
              “{template.prompt.existence}”
            </p>
            <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] text-ink-faint">
              まだ生成なし — 開いて実行
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {template?.nameJa ?? id}
          </h3>
          <span className="truncate text-[11px] text-ink-faint">
            {template?.name}
          </span>
          {note?.rating ? (
            <span className="ml-auto shrink-0 text-[11px] text-accent">
              {"★".repeat(note.rating)}
            </span>
          ) : null}
        </div>

        {template && (
          <>
            <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
              <span className="rounded-full bg-ink/5 px-2 py-0.5">
                {TAXONOMY_LABELS[template.taxonomy]}
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono",
                  engine?.available
                    ? "border-hairline"
                    : "border-dashed border-ink-faint text-ink-faint",
                )}
                title={engine ? `${engine.name} — ${engine.roleJa}` : undefined}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    engine?.available ? "bg-emerald-500" : "bg-ink-faint",
                  )}
                />
                {template.engine}
                {!engine?.available && "(モック)"}
              </span>
              {template.logoTypes.map((t) => (
                <span key={t} className="rounded-full border border-hairline px-2 py-0.5">
                  {LOGO_TYPE_LABELS[t]}
                </span>
              ))}
              {(template.impressions ?? []).map((t) => (
                <span key={t} className="rounded-full px-1 py-0.5">
                  #{t}
                </span>
              ))}
            </div>

            {balanced && (
              <div className="mt-auto grid grid-cols-4 gap-2 pt-1">
                {DIAL_AXES.map((axis) => {
                  const locked = Boolean(template.dials?.locks?.[axis]);
                  return (
                    <div key={axis} title={locked ? "テンプレートによる固定" : undefined}>
                      <div className="h-1 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className={cn("h-full", locked ? "bg-ink-faint" : "bg-accent")}
                          style={{ width: `${balanced[axis] * 100}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] text-ink-faint">
                        {DIAL_LABELS[axis]}
                        {locked && " 🔒"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
