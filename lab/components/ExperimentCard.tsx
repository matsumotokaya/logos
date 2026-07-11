"use client";

// Catalog card: idle shows the logo at rest; hovering mounts the experiment
// and plays it from the top; clicking opens the fullscreen preview.

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  supportsLogo,
  type LabLogo,
} from "@/lab/core/experiment-api";
import type { ExperimentEntry } from "@/lab/experiments/registry";
import {
  getNotesSnapshot,
  getServerNotesSnapshot,
  subscribeNotes,
} from "@/lab/core/notes-store";
import LogoThumb from "./LogoThumb";

export default function ExperimentCard({
  entry,
  logo,
  onOpen,
}: {
  entry: ExperimentEntry;
  logo: LabLogo | null;
  onOpen: (id: string) => void;
}) {
  const { meta, Component } = entry;
  const [hover, setHover] = useState(false);
  const [nonce, setNonce] = useState(0);
  const note = useSyncExternalStore(
    subscribeNotes,
    () => getNotesSnapshot()[meta.id],
    () => getServerNotesSnapshot()[meta.id],
  );

  const planned = meta.status === "planned" || !Component;
  const supported = !!logo && supportsLogo(meta, logo);
  const runnable = !planned && supported && !!logo;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-hairline bg-white transition",
        runnable && "cursor-pointer hover:border-ink-faint hover:shadow-sm",
      )}
      onMouseEnter={() => {
        if (!runnable) return;
        setHover(true);
        setNonce((n) => n + 1);
      }}
      onMouseLeave={() => setHover(false)}
      onClick={() => runnable && onOpen(meta.id)}
    >
      <div className="relative aspect-[16/10] border-b border-hairline bg-white">
        {planned ? (
          <div className="flex h-full items-center justify-center">
            <span className="rounded-full border border-dashed border-ink-faint px-3 py-1 text-[11px] text-ink-faint">
              予定 — {CATEGORY_LABELS[meta.category]}
            </span>
          </div>
        ) : !logo ? null : !supported ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-[62%] w-[62%] opacity-25 grayscale">
              <LogoThumb logo={logo} />
            </div>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted">
              {logo.kind.toUpperCase()} 非対応
            </span>
          </div>
        ) : hover && Component ? (
          <Component logo={logo} playing replayNonce={nonce} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-[62%] w-[62%]">
              <LogoThumb logo={logo} />
            </div>
            <span className="absolute right-2 bottom-2 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-muted opacity-0 transition group-hover:opacity-100">
              hoverで再生
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-ink-faint">{meta.id}</span>
          <h3 className="text-sm font-semibold tracking-tight">{meta.title}</h3>
          {note?.rating ? (
            <span className="ml-auto text-[11px] text-accent">
              {"★".repeat(note.rating)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-ink-muted">
          <span className="rounded-full bg-ink/5 px-2 py-0.5">
            {CATEGORY_LABELS[meta.category]}
          </span>
          {meta.tech.map((t) => (
            <span key={t} className="rounded-full border border-hairline px-2 py-0.5 font-mono">
              {t}
            </span>
          ))}
          {meta.impressions.map((t) => (
            <span key={t} className="rounded-full px-1 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
