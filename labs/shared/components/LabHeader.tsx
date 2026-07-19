"use client";

// The labs' top header — the same frame as the product header (Landing /
// Presentation), only the wordmark differs: "labos" instead of "logos".
// Same right-hand cluster (language switcher + account/menu), same full-bleed
// bar and hairline. Below it, an optional sub-bar names the current lab so
// you always know which lab you are in.
//
// Every labs page (the index and each lab) renders this, so the whole labs
// surface reads as one "labos" mode of the product — not a separate app.

import Link from "next/link";
import { cn } from "@/lib/cn";
import AppHeader from "@/components/AppHeader";
import { MODE_INFO, type LabMode } from "@/labs/directory";

export const LAB_CONTENT_WIDTH = "max-w-6xl";

export default function LabHeader({
  current,
}: {
  /** The lab you are in; omit on the labs index. */
  current?: { name: string; titleJa: string; mode: LabMode };
}) {
  return (
    <>
      <AppHeader variant="labs" />

      {current && (
        <div className="border-b border-hairline bg-paper/90 backdrop-blur">
          <div className={cn("mx-auto flex items-center gap-3 px-6 py-2.5 md:px-10", LAB_CONTENT_WIDTH)}>
            <Link
              href="/labs"
              className="text-xs text-ink-muted transition hover:text-ink"
            >
              Labs
            </Link>
            <span className="text-ink-faint" aria-hidden="true">/</span>
            <h1 className="font-display text-sm font-semibold tracking-tight">
              {current.name}
            </h1>
            <span className="hidden text-[11px] text-ink-muted sm:inline">
              {current.titleJa}
            </span>
            <span className="ml-auto rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
              {MODE_INFO[current.mode].label}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
