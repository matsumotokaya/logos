"use client";

// Presentation permalink. The reserved id "sample" renders the built-in
// sample logo without persisting anything.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestAuthDialog, useAuth } from "@/lib/auth";
import { analyzeSvg, normalizeLogoData, type LogoData } from "@/lib/svg";
import { SAMPLE_SVG, SAMPLE_NAME } from "@/lib/sample";
import { emptyPresentation, repo, type LogoPresentation } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import Presentation from "@/components/Presentation";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ready";
      logo: LogoData;
      name: string;
      mockupCandidateId: string | null;
      stored: boolean;
      canEdit: boolean;
      contactEmail: string | null;
    };

export default function PresentationPage({
  params,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  embedded?: boolean;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { dict } = useI18n();
  const [state, setState] = useState<State>({ status: "loading" });
  const [pres, setPres] = useState<LogoPresentation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      let nextPres: LogoPresentation | null = null;
      if (id === "sample") {
        try {
          next = {
            status: "ready",
            logo: analyzeSvg(SAMPLE_SVG, "sample.svg"),
            name: SAMPLE_NAME,
            mockupCandidateId: null,
            stored: false,
            canEdit: false,
            contactEmail: null,
          };
        } catch {
          next = { status: "missing" };
        }
      } else {
        const stored = await repo.getLogo(id);
        if (stored) {
          // The contact button targets the first credit with an email address.
          const contactEmail = stored.allowContact
            ? (stored.credits.find((c) => c.contact.includes("@"))?.contact ??
              null)
            : null;
          next = {
            status: "ready",
            logo: normalizeLogoData(stored.data, stored.title),
            name: stored.title,
            mockupCandidateId: stored.primaryCandidateId ?? null,
            stored: true,
            canEdit: stored.canEditPresentation ?? stored.canEdit ?? true,
            contactEmail,
          };
          nextPres = await repo.getPresentation(id);
        } else {
          next = { status: "missing" };
        }
      }
      if (cancelled) return;
      setState(next);
      setPres(nextPres);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleCommitEdits = async ({
    name,
    presentation,
  }: {
    name: string;
    presentation: LogoPresentation;
  }) => {
    if (state.status !== "ready") return;
    const base = pres ?? emptyPresentation();
    const nextName = name.trim() || state.name;
    const nameChanged = nextName !== state.name;
    const presentationChanged =
      presentation.catchphrase !== base.catchphrase ||
      presentation.story !== base.story ||
      JSON.stringify(presentation.sceneTexts) !==
        JSON.stringify(base.sceneTexts) ||
      JSON.stringify(presentation.layout) !== JSON.stringify(base.layout);

    if (!nameChanged && !presentationChanged) return;

    setState({ ...state, name: nextName });
    setPres(presentation);

    await Promise.all([
      nameChanged
        ? repo.updateLogo(id, { title: nextName })
        : Promise.resolve(),
      presentationChanged
        ? repo.savePresentation(id, presentation)
        : Promise.resolve(),
    ]);
  };

  if (state.status === "loading") {
    return <main className="min-h-dvh bg-paper" />;
  }

  if (state.status === "missing") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-ink">
        <p className="font-mono text-xs uppercase text-ink-muted">404</p>
        <h1 className="mt-4 text-balance text-center font-display text-3xl font-medium">
          {dict.notFound.title}
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-center text-sm text-ink-muted">
          {dict.notFound.body}
        </p>
        <Link
          href="/"
          className="mt-8 bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          {dict.notFound.back}
        </Link>
      </main>
    );
  }

  return (
    <Presentation
      logo={state.logo}
      name={state.name}
      mockupLogoId={id === "sample" ? undefined : id}
      mockupCandidateId={state.mockupCandidateId ?? undefined}
      onReset={() => router.push(embedded ? "/logos" : "/")}
      contactEmail={state.contactEmail}
      presentation={pres}
      canEdit={state.stored && state.canEdit}
      isSignedIn={isSignedIn}
      onRequestSignIn={() => requestAuthDialog("signin")}
      onCommitEdits={
        state.stored && state.canEdit && isSignedIn
          ? (payload) => void handleCommitEdits(payload)
          : undefined
      }
      embedded={embedded}
    />
  );
}
