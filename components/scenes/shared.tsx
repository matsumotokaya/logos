"use client";

import { createContext, useContext } from "react";
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
  mockupLogoId?: string;
  mockupCandidateId?: string;
};

// ---------------------------------------------------------------------------
// In-place presentation editing (layer B: catchphrase, story, scene leads).
// Scenes read overrides from this context; outside a provider (e.g. the
// sample presentation) they fall back to the auto-generated copy.

/** One text change, saved on blur. Empty string clears the override. */
export type PresentationTextPatch =
  | { catchphrase: string }
  | { story: string }
  | { sceneLead: { slug: string; lead: string } };

type PresentationEditCtx = {
  editing: boolean;
  catchphrase: string;
  story: string;
  /** Lead overrides keyed by scene slug; absent = auto copy. */
  sceneLeads: Record<string, string | undefined>;
  save: (patch: PresentationTextPatch) => void;
};

const PresentationEditContext = createContext<PresentationEditCtx>({
  editing: false,
  catchphrase: "",
  story: "",
  sceneLeads: {},
  save: () => {},
});

export const PresentationEditProvider = PresentationEditContext.Provider;

export function usePresentationEdit(): PresentationEditCtx {
  return useContext(PresentationEditContext);
}

/**
 * Blog-style in-place editable paragraph. Shows the override (or the
 * auto-generated fallback); in edit mode it becomes contentEditable and
 * saves on blur. Clearing the text — or restoring it to the fallback —
 * removes the override so the auto copy returns.
 */
export function EditableText({
  value,
  fallback,
  onSave,
  ariaLabel,
  className,
}: {
  value: string;
  fallback: string;
  onSave: (next: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const { editing } = usePresentationEdit();
  const text = value || fallback;
  if (!editing) return <p className={className}>{text}</p>;
  return (
    <p
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={ariaLabel}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? "").trim();
        onSave(next === fallback ? "" : next);
      }}
      className={cn(
        className,
        "cursor-text outline-1 outline-dashed outline-accent/50 outline-offset-4 focus:outline-2 focus:outline-solid focus:outline-accent"
      )}
    >
      {text}
    </p>
  );
}

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s || "brand";
}

/**
 * Standard editorial opener for a guideline section on the white document
 * base: mono caption, display heading, optional muted lead paragraph.
 * Pass `slug` to make the lead editable/overridable in edit mode.
 */
export function SectionIntro({
  n,
  title,
  lead,
  slug,
}: {
  n: string;
  title: string;
  lead?: string;
  slug?: string;
}) {
  const { sceneLeads, save } = usePresentationEdit();
  const leadCls =
    "mt-6 max-w-prose leading-relaxed text-pretty text-ink-muted";
  return (
    <div className="px-6 pt-16 pb-10 md:px-12 md:pt-24 md:pb-14">
      <Caption n={n} title={title} tone="paper" />
      <h2 className="mt-6 max-w-3xl font-display text-4xl font-medium text-balance md:text-6xl">
        {title}
      </h2>
      {lead &&
        (slug ? (
          <EditableText
            value={sceneLeads[slug] ?? ""}
            fallback={lead}
            onSave={(next) => save({ sceneLead: { slug, lead: next } })}
            ariaLabel={title}
            className={leadCls}
          />
        ) : (
          <p className={leadCls}>{lead}</p>
        ))}
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
