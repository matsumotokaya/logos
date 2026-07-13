"use client";

// Shared filter chip row ("すべて" + options) used by every lab's catalog.

import { cn } from "@/lib/cn";

export default function FilterChips({
  label,
  value,
  onChange,
  options,
  mono,
  allLabel = "すべて",
}: {
  /** Optional row label (uppercase tracked, fixed width). */
  label?: string;
  value: string;
  onChange: (v: string) => void;
  /** [value, displayText] pairs; "all" is prepended automatically. */
  options: [string, string][];
  /** Monospace option text (e.g. tech names). */
  mono?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && (
        <span className="mr-1 w-14 shrink-0 text-[10px] tracking-widest text-ink-faint uppercase">
          {label}
        </span>
      )}
      {[["all", allLabel] as [string, string], ...options].map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] transition",
            mono && v !== "all" && "font-mono",
            value === v
              ? "border-accent bg-accent text-white"
              : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
