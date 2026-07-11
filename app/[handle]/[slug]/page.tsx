"use client";

// Vanity URL: /[handle]/[slug] resolves to the canonical permalink /p/[id]
// and redirects there (docs/account-design.md §2). The permalink never
// changes; this route is just a friendlier front door for public logos.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveVanity } from "@/lib/vanity";
import { useI18n } from "@/lib/i18n";

export default function VanityPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = use(params);
  const router = useRouter();
  const { dict } = useI18n();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveVanity(handle, slug).then((id) => {
      if (cancelled) return;
      if (id) router.replace(`/p/${id}`);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [handle, slug, router]);

  if (!missing) {
    return <main className="min-h-dvh bg-paper" />;
  }

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
