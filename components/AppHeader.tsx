"use client";

import Link from "next/link";
import { SERVICE_NAME } from "@/lib/config";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Account from "@/components/Account";
import MainNav from "@/components/MainNav";

type HeaderLink = {
  href: string;
  label: string;
};

export default function AppHeader({
  section,
  links = [],
}: {
  section?: string;
  links?: HeaderLink[];
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper px-6 py-4 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-w-0 items-baseline gap-3 text-ink hover:text-ink-muted"
        >
          <span className="font-display text-base font-medium">
            {SERVICE_NAME}
            <span className="align-super text-[10px]">®</span>
          </span>
          {section && (
            <span className="truncate text-xs font-normal text-ink-muted">
              {section}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {links.length > 0 && (
            <nav
              className="hidden items-center gap-4 sm:flex"
              aria-label={`${section ?? SERVICE_NAME} navigation`}
            >
              {links.map((link) => (
                <Link
                  key={`${link.href}:${link.label}`}
                  href={link.href}
                  className="text-sm text-ink-muted hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          <LanguageSwitcher />
          <Account />
          <MainNav />
        </div>
      </div>
    </header>
  );
}
