"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LABS_NAME, SERVICE_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Account from "@/components/Account";
import MainNav from "@/components/MainNav";

export default function AppHeader({
  variant = "logos",
  section,
  actions,
  sticky = false,
  tone = "dark",
}: {
  variant?: "logos" | "labs";
  section?: string;
  actions?: ReactNode;
  sticky?: boolean;
  /** "light" renders white text over a dark/photographic surface (no bg, no border). */
  tone?: "dark" | "light";
}) {
  const labs = variant === "labs";
  const light = tone === "light";
  const name = labs ? LABS_NAME : SERVICE_NAME;

  return (
    <header
      className={cn(
        light ? "border-b border-transparent" : "border-b border-hairline bg-paper",
        sticky && "sticky top-0 z-30 bg-paper/90 backdrop-blur-sm",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-4 px-6 py-5 md:px-10">
        <Link
          href={labs ? "/labs" : "/"}
          className={cn(
            "flex min-w-0 items-baseline gap-3",
            light ? "text-white hover:text-white/70" : "text-ink hover:text-ink-muted",
          )}
        >
          <span className="font-display text-xl font-medium">
            {name}
            <span className="align-super text-[0.55em]">®</span>
          </span>
          {section && (
            <span
              className={cn(
                "hidden truncate text-xs font-normal sm:inline",
                light ? "text-white/60" : "text-ink-muted",
              )}
            >
              {section}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher tone={tone} />
          <Account tone={tone} />
          <MainNav tone={tone} />
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline px-6 py-2.5 md:px-10">
          {actions}
        </div>
      )}
    </header>
  );
}
