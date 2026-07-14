"use client";

// The shared lab page skeleton. Every lab reads the same way:
//
//   LabHeader  — "labos" wordmark + language + account (same as the product
//                header), with a sub-bar naming the current lab
//   explainer  — optional 仕組みを見る block
//   LogoRail   — pick the logo; THE LOGO IS THE PAGE'S SUBJECT
//   children(logo) — everything below is that logo's view of this lab
//
// Labs must not rebuild this frame; they provide their content as a render
// function of the selected logo, and identify themselves by slug (name /
// titleJa / mode all come from labs/directory.ts — the single catalog).

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import {
  getLogoStoreState,
  getServerLogoStoreState,
  initLogoStore,
  subscribeLogoStore,
} from "@/labs/motion/core/logo-store";
import LogoRail from "@/labs/motion/components/LogoRail";
import { getLab } from "@/labs/directory";
import LabHeader, { LAB_CONTENT_WIDTH } from "./LabHeader";

export { LAB_CONTENT_WIDTH };

export default function LabShell({
  slug,
  explainer,
  logoNote,
  children,
}: {
  /** Lab slug; name / titleJa / mode are read from labs/directory.ts. */
  slug: string;
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

  const lab = getLab(slug);
  const logo = store.logos.find((l) => l.id === store.selectedId) ?? null;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <LabHeader
        current={lab && { name: lab.name, titleJa: lab.titleJa, mode: lab.mode }}
      />

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
