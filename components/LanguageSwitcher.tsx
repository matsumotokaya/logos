"use client";

// Compact language control: a globe pictogram + the current locale's short
// code (EN / JA / KO / 繁 / 简). Click opens a small menu of the full names.
// Custom dropdown (not <select>) so the trigger can show icon + short code.

import { useEffect, useRef, useState } from "react";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/cn";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LanguageSwitcher({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  const { locale, setLocale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const muted = tone === "dark" ? "text-ink-muted hover:text-ink" : "text-white/70 hover:text-white";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={dict.header.language}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-1.5 py-1 transition-colors",
          muted,
          tone === "dark" ? "hover:bg-ink/5" : "hover:bg-white/10",
        )}
      >
        <GlobeIcon className="size-4" />
        <span className="font-mono text-xs">{current.short}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-hairline bg-paper py-1.5 shadow-lg"
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === locale}
              onClick={() => {
                setLocale(l.code as Locale);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-ink/5",
                l.code === locale ? "text-ink" : "text-ink-muted",
              )}
            >
              <span className="w-6 font-mono text-[11px] text-ink-faint">{l.short}</span>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
