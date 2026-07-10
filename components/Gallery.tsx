"use client";

// Logo gallery on the top page. Each card links to its presentation
// permalink (/p/[id]). An empty result is a normal state, not an error.

import { useEffect, useState } from "react";
import Link from "next/link";
import { repo, type StoredLogo } from "@/lib/store";
import { svgToDataUri } from "@/lib/svg";
import { useI18n } from "@/lib/i18n";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

export default function Gallery() {
  const { dict } = useI18n();
  // null = not loaded yet (avoids a one-frame empty-state flash on mount).
  const [logos, setLogos] = useState<StoredLogo[] | null>(null);

  useEffect(() => {
    repo.listLogos().then(setLogos);
  }, []);

  if (!logos) return null;

  return (
    <section
      aria-label={dict.gallery.title}
      className="border-t border-hairline px-6 py-16 md:px-10"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-mono text-xs uppercase text-ink-muted">
          <span
            aria-hidden="true"
            className="mr-3 inline-block size-2 bg-accent align-middle"
          />
          {dict.gallery.title}
        </p>

        {logos.length === 0 ? (
          <div className="mt-8 border border-dashed border-hairline p-10">
            <p className="max-w-prose text-pretty text-sm text-ink-muted">
              {dict.gallery.empty}
            </p>
            <Link
              href="/p/sample"
              className="mt-4 inline-block text-sm text-ink underline underline-offset-4 transition-colors hover:text-accent"
            >
              {dict.landing.sample}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {logos.map((logo) => (
              <li key={logo.id}>
                <Link
                  href={`/p/${logo.id}`}
                  className="group block border border-hairline transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <div className="flex aspect-[4/3] items-center justify-center p-6 md:p-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={svgToDataUri(logo.data.svg)}
                      alt=""
                      className="max-h-full w-2/3 object-contain"
                    />
                  </div>
                  <div className="border-t border-hairline px-4 py-3">
                    <p className="truncate text-sm font-medium">{logo.title}</p>
                    <p className="mt-1 font-mono text-xs uppercase text-ink-faint">
                      {dict.roles[logo.role]} ·{" "}
                      <span className="tabular-nums">
                        {formatDate(logo.createdAt)}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
