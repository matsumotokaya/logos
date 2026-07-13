"use client";

// The shared lab page skeleton. Every lab reads the same way:
//
//   header (identity + back links)
//   explainer (optional 仕組みを見る block)
//   LogoRail — pick the logo; THE LOGO IS THE PAGE'S SUBJECT
//   children(logo) — everything below is that logo's view of this lab
//
// Labs must not rebuild this frame; they provide their content as a render
// function of the selected logo. The logo registry itself lives in
// labs/motion/core (the labs' shared infrastructure, see labs/README.md).

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import {
  getLogoStoreState,
  getServerLogoStoreState,
  initLogoStore,
  subscribeLogoStore,
} from "@/labs/motion/core/logo-store";
import LogoRail from "@/labs/motion/components/LogoRail";

export default function LabShell({
  name,
  tagline,
  explainer,
  logoNote,
  children,
}: {
  /** Product-style lab name, e.g. "Motion Lab". */
  name: string;
  /** One-line stance shown next to the name. */
  tagline: string;
  /** Optional collapsible explainer rendered between header and rail. */
  explainer?: ReactNode;
  /** Privacy/usage note shown on the logo rail (e.g. where the logo goes). */
  logoNote?: string;
  /** The lab's content for the currently selected logo. */
  children: (logo: LabLogo) => ReactNode;
}) {
  const store = useSyncExternalStore(
    subscribeLogoStore,
    getLogoStoreState,
    getServerLogoStoreState,
  );
  useEffect(() => {
    void initLogoStore();
  }, []);

  const logo = store.logos.find((l) => l.id === store.selectedId) ?? null;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h1 className="font-display text-sm font-semibold tracking-tight">
            {name}
          </h1>
          <p className="hidden text-[11px] text-ink-muted sm:block">
            — {tagline}
          </p>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/labs" className="text-xs text-ink-muted transition hover:text-ink">
              ← Labs
            </Link>
            <Link href="/" className="text-xs text-ink-muted transition hover:text-ink">
              本体へ戻る
            </Link>
          </div>
        </div>
      </header>

      {explainer}

      {store.ready && logo ? (
        <>
          <LogoRail
            logos={store.logos}
            selectedId={store.selectedId}
            note={logoNote}
          />
          {children(logo)}
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          ロゴを解析中…
        </div>
      )}
    </div>
  );
}
