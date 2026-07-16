"use client";

// The hamburger — user-facing navigation across the product. Home and (later)
// Gallery live here; Assets and Brand Manager are reached from here too. This is the
// public wayfinding menu; account actions and the internal Labs entrance live
// in the avatar menu instead (see Account.tsx).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export default function MainNav({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const items: { href: string; label: string }[] = [
    { href: "/", label: dict.header.home },
    // Gallery gets its own route later; for now Home carries the gallery.
    { href: "/assets", label: dict.header.assets },
    { href: "/brand", label: dict.header.brandManager },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-colors",
          tone === "dark" ? "text-ink-muted hover:bg-ink/5 hover:text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-hairline bg-paper py-1.5 shadow-lg"
        >
          {items.map((it) => (
            <Link
              key={it.href}
              role="menuitem"
              href={it.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
