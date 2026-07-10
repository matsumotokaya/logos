"use client";

import { useI18n } from "@/lib/i18n";

/** Table of contents — anchors into the numbered sections of the document. */
export default function Contents() {
  const { dict } = useI18n();
  const entries = [
    dict.scenes.identity,
    dict.scenes.construction,
    dict.scenes.color,
    dict.scenes.usage,
    dict.scenes.appIcon,
    dict.scenes.web,
    dict.scenes.social,
    dict.scenes.onsite,
    dict.scenes.merch,
    dict.scenes.generated,
  ];

  return (
    <section className="flex min-h-dvh flex-col justify-center border-t border-hairline bg-paper px-6 py-16 md:px-12 md:py-24">
      <p className="font-mono text-xs uppercase text-ink-muted">
        {dict.doc.contents}
      </p>
      <nav className="mt-10">
        <ol className="grid gap-x-12 md:grid-cols-2">
          {entries.map((title, i) => {
            const n = String(i + 1).padStart(2, "0");
            return (
              <li key={n} className="border-b border-hairline">
                <a
                  href={`#s${n}`}
                  className="group flex items-baseline gap-6 py-4 transition-colors hover:text-accent"
                >
                  <span className="font-mono text-xs text-ink-muted transition-colors tabular-nums group-hover:text-accent">
                    {n}
                  </span>
                  <span className="font-display text-xl font-medium md:text-2xl">
                    {title}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}
