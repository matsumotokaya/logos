"use client";

// Shared "仕組みを見る" explainer: the collapsible frame each lab uses to
// show its architecture/requirement modules with 稼働中/未着手 badges.
// The content (modules, footnote) is the lab's; the frame and the module
// card are one shared idiom so all labs read as one system.

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LabExplainer({
  summary,
  gridClass = "sm:grid-cols-2 lg:grid-cols-4",
  children,
  footnote,
}: {
  /** The one-line collapsed teaser, e.g. "仕組みを見る — …". */
  summary: string;
  /** Tailwind grid columns for the module cards. */
  gridClass?: string;
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="border-b border-hairline bg-white">
      <details className="group mx-auto max-w-7xl px-6 py-3">
        <summary className="cursor-pointer list-none text-[11px] text-ink-muted marker:content-none">
          <span className="mr-1 inline-block text-ink-faint transition group-open:rotate-90">
            ›
          </span>
          {summary}
        </summary>
        <div className={cn("mt-3 grid gap-4 pb-1 text-[11px] leading-relaxed text-ink-muted", gridClass)}>
          {children}
        </div>
        {footnote && (
          <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-faint">
            {footnote}
          </p>
        )}
      </details>
    </div>
  );
}

export function ExplainerModule({
  code,
  title,
  body,
  active,
}: {
  /** Short module code, e.g. "Layer 2" / "E-4". */
  code: string;
  title: string;
  body: string;
  active?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-3", active ? "border-accent/40 bg-accent/5" : "border-hairline")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("font-mono text-[10px]", active ? "text-accent" : "text-ink-faint")}>
          {code}
        </span>
        {active ? (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] text-white">
            稼働中
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-ink-faint px-1.5 py-0.5 text-[9px] text-ink-faint">
            未着手
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
