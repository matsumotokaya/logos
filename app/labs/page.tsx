// Labs index — the R&D constellation, grouped by mode. Server-rendered,
// internal, noindex. The mode split (assurance / exploration / integration)
// is the product's core promise made visible: what never touches the logo
// vs. what interprets it — see labs/README.md.

import type { Metadata } from "next";
import Link from "next/link";
import { LABS, MODE_INFO, MODE_ORDER } from "@/labs/directory";
import { cn } from "@/lib/cn";
import LabHeader from "@/labs/shared/components/LabHeader";

export const metadata: Metadata = {
  title: "Labs — R&D",
  robots: { index: false, follow: false },
};

export default function LabsIndexPage() {
  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <LabHeader />

      <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        {MODE_ORDER.map((mode) => {
          const labs = LABS.filter((lab) => lab.mode === mode);
          if (labs.length === 0) return null;
          const info = MODE_INFO[mode];
          return (
            <section key={mode} className="mt-10">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-base font-semibold tracking-tight">
                  {info.label}
                </h2>
                <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
              </div>
              <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-ink-muted">
                {info.description}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {labs.map((lab) => (
                  <Link
                    key={lab.slug}
                    href={`/labs/${lab.slug}`}
                    className={cn(
                      "group flex flex-col rounded-xl border bg-white p-6 transition",
                      lab.status === "active"
                        ? "border-hairline hover:border-accent hover:shadow-sm"
                        : "border-dashed border-ink-faint hover:border-ink-muted",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-lg font-semibold tracking-tight">
                        {lab.name}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          lab.status === "active"
                            ? "bg-accent text-white"
                            : "border border-dashed border-ink-faint text-ink-muted",
                        )}
                      >
                        {lab.status === "active" ? "稼働中" : "準備中"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{lab.titleJa}</p>
                    <p className="mt-3 text-sm leading-relaxed">{lab.tagline}</p>
                    <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                      {lab.layer}
                    </p>
                    <span
                      className={cn(
                        "mt-4 text-xs",
                        lab.status === "active"
                          ? "text-accent"
                          : "text-ink-muted group-hover:text-ink",
                      )}
                    >
                      {lab.status === "active" ? "ラボに入る →" : "計画を見る →"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
