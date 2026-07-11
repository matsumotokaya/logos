"use client";

// Logo gallery on the top page: the viewer's own logos first, then a
// discover section with everyone's public logos. Each card links to its
// presentation permalink (/p/[id]). An empty result is a normal state,
// not an error.

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

function Caption({ label }: { label: string }) {
  return (
    <p className="font-mono text-xs uppercase text-ink-muted">
      <span
        aria-hidden="true"
        className="mr-3 inline-block size-2 bg-accent align-middle"
      />
      {label}
    </p>
  );
}

function CardGrid({ logos }: { logos: StoredLogo[] }) {
  const { dict } = useI18n();
  return (
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
  );
}

export default function Gallery() {
  const { dict } = useI18n();
  // null = not loaded yet (avoids a one-frame empty-state flash on mount).
  const [mine, setMine] = useState<StoredLogo[] | null>(null);
  const [publicLogos, setPublicLogos] = useState<StoredLogo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repo.listLogos(), repo.listPublicLogos()]).then(
      ([own, pub]) => {
        if (cancelled) return;
        setMine(own);
        setPublicLogos(pub);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mine || !publicLogos) return null;

  // The viewer's own public logos already appear under "mine".
  const mineIds = new Set(mine.map((logo) => logo.id));
  const discover = publicLogos.filter((logo) => !mineIds.has(logo.id));

  return (
    <section
      aria-label={dict.gallery.title}
      className="border-t border-hairline px-6 py-16 md:px-10"
    >
      <div className="mx-auto w-full max-w-6xl">
        {mine.length === 0 && discover.length === 0 ? (
          <>
            <Caption label={dict.gallery.title} />
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
          </>
        ) : (
          <div className="space-y-16">
            {mine.length > 0 && (
              <div>
                <Caption label={dict.gallery.mine} />
                <CardGrid logos={mine} />
              </div>
            )}
            {discover.length > 0 && (
              <div>
                <Caption label={dict.gallery.title} />
                <CardGrid logos={discover} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
