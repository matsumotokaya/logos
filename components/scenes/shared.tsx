import type { LogoData } from "@/lib/svg";
import { cn } from "@/lib/cn";

export type Variants = {
  /** Logo repainted in off-white (#F4F4F2), for dark surfaces. */
  white: string;
  /** Logo repainted in near-black (#101012), for light surfaces. */
  black: string;
};

export type SceneProps = {
  logo: LogoData;
  name: string;
  variants: Variants;
};

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s || "brand";
}

/**
 * Standard editorial opener for a guideline section on the white document
 * base: mono caption, display heading, optional muted lead paragraph.
 */
export function SectionIntro({
  n,
  title,
  lead,
}: {
  n: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="px-6 pt-16 pb-10 md:px-12 md:pt-24 md:pb-14">
      <Caption n={n} title={title} tone="paper" />
      <h2 className="mt-6 max-w-3xl font-display text-4xl font-medium text-balance md:text-6xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-6 max-w-prose leading-relaxed text-pretty text-ink-muted">
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * Editorial section caption, e.g. "02 — Construction".
 * `tone="plate"` (default) is for dark artboard sections; `tone="paper"`
 * for sections on the white document base.
 */
export function Caption({
  n,
  title,
  tone = "plate",
}: {
  n: string;
  title: string;
  tone?: "plate" | "paper";
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs uppercase",
        tone === "plate" ? "text-white/40" : "text-ink-muted"
      )}
    >
      <span className={tone === "paper" ? "text-accent" : undefined}>{n}</span>
      {" — "}
      {title}
    </p>
  );
}
