"use client";

import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export default function LanguageSwitcher({
  className,
}: {
  className?: string;
}) {
  const { locale, setLocale, dict } = useI18n();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={dict.header.language}
      className={cn(
        "cursor-pointer appearance-none rounded-none border-b border-transparent bg-transparent py-1 font-mono text-xs uppercase text-ink-muted transition-colors hover:text-ink focus:border-ink focus:outline-none",
        className
      )}
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
