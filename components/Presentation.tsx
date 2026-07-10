"use client";

import { useMemo } from "react";
import { recolorSvg, type LogoData } from "@/lib/svg";
import { SERVICE_NAME } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Variants } from "@/components/scenes/shared";
import Splash from "@/components/scenes/Splash";
import Contents from "@/components/scenes/Contents";
import Identity from "@/components/scenes/Identity";
import Construction from "@/components/scenes/Construction";
import Palette from "@/components/scenes/Palette";
import UsageGrid from "@/components/scenes/UsageGrid";
import AppIcons from "@/components/scenes/AppIcons";
import Browser from "@/components/scenes/Browser";
import Social from "@/components/scenes/Social";
import Badge from "@/components/scenes/Badge";
import Merch from "@/components/scenes/Merch";
import Generated from "@/components/scenes/Generated";

type Props = {
  logo: LogoData;
  name: string;
  onNameChange: (name: string) => void;
  onReset: () => void;
};

export default function Presentation({ logo, name, onNameChange, onReset }: Props) {
  const { dict, format } = useI18n();
  const variants = useMemo<Variants>(
    () => ({
      white: recolorSvg(logo.svg, "#F4F4F2"),
      black: recolorSvg(logo.svg, "#101012"),
    }),
    [logo.svg]
  );

  const scene = { logo, name, variants };

  return (
    <main className="bg-paper text-ink">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-paper/90 px-6 py-4 backdrop-blur-sm md:px-12">
        <div className="flex items-baseline gap-4">
          <p className="font-display text-base font-medium">
            {SERVICE_NAME}
            <span className="align-super text-[10px]">®</span>
          </p>
          <p className="hidden font-mono text-xs uppercase text-ink-muted sm:block">
            {dict.doc.brandGuidelines} — {name}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <LanguageSwitcher />
          <a
            href="/admin"
            className="text-sm text-ink-muted transition-colors hover:text-ink"
          >
            {dict.header.admin}
          </a>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label={dict.header.brandName}
            className="w-40 border-b border-hairline bg-transparent px-1 py-1.5 text-sm focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={onReset}
            className="bg-ink px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            {dict.header.newLogo}
          </button>
        </div>
      </header>

      <Splash {...scene} />
      <Contents />
      {/* Anchor wrappers for the table of contents; offset for the sticky header. */}
      <div id="s01" className="scroll-mt-16">
        <Identity {...scene} />
      </div>
      <div id="s02" className="scroll-mt-16">
        <Construction {...scene} />
      </div>
      <div id="s03" className="scroll-mt-16">
        <Palette {...scene} />
      </div>
      <div id="s04" className="scroll-mt-16">
        <UsageGrid {...scene} />
      </div>
      <div id="s05" className="scroll-mt-16">
        <AppIcons {...scene} />
      </div>
      <div id="s06" className="scroll-mt-16">
        <Browser {...scene} />
      </div>
      <div id="s07" className="scroll-mt-16">
        <Social {...scene} />
      </div>
      <div id="s08" className="scroll-mt-16">
        <Badge {...scene} />
      </div>
      <div id="s09" className="scroll-mt-16">
        <Merch {...scene} />
      </div>
      <div id="s10" className="scroll-mt-16">
        <Generated {...scene} />
      </div>

      <footer className="flex items-center justify-between border-t border-hairline px-6 py-10 md:px-12">
        <p className="font-mono text-xs uppercase text-ink-muted">
          {format(dict.footer.generatedWith, { service: SERVICE_NAME })}
        </p>
        <p className="font-mono text-xs uppercase text-ink-muted">
          {dict.doc.version} 1.0 — {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
