"use client";

// Presentation permalink. The reserved id "sample" renders the built-in
// sample logo without persisting anything.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analyzeSvg, type LogoData } from "@/lib/svg";
import { SAMPLE_SVG, SAMPLE_NAME } from "@/lib/sample";
import { repo } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import Presentation from "@/components/Presentation";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; logo: LogoData; name: string; stored: boolean };

export default function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { dict } = useI18n();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (id === "sample") {
        try {
          next = {
            status: "ready",
            logo: analyzeSvg(SAMPLE_SVG, "sample.svg"),
            name: SAMPLE_NAME,
            stored: false,
          };
        } catch {
          next = { status: "missing" };
        }
      } else {
        const stored = await repo.getLogo(id);
        next = stored
          ? { status: "ready", logo: stored.data, name: stored.title, stored: true }
          : { status: "missing" };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      onNameChange={(name) => {
        setState({ ...state, name });
        // Renaming a stored logo updates its canonical title everywhere.
        if (state.stored) void repo.updateLogo(id, { title: name });
      }}
      onReset={() => router.push("/")}
    />
  );
}
