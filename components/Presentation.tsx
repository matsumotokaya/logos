"use client";

import { useMemo } from "react";
import { recolorSvg, type LogoData } from "@/lib/svg";
import { SERVICE_NAME } from "@/lib/config";
import type { Variants } from "@/components/scenes/shared";
import Hero from "@/components/scenes/Hero";
import Construction from "@/components/scenes/Construction";
import Palette from "@/components/scenes/Palette";
import UsageGrid from "@/components/scenes/UsageGrid";
import AppIcons from "@/components/scenes/AppIcons";
import Browser from "@/components/scenes/Browser";
import Social from "@/components/scenes/Social";
import Badge from "@/components/scenes/Badge";

type Props = {
  logo: LogoData;
  name: string;
  onNameChange: (name: string) => void;
  onReset: () => void;
};

export default function Presentation({ logo, name, onNameChange, onReset }: Props) {
  const variants = useMemo<Variants>(
    () => ({
      white: recolorSvg(logo.svg, "#F1F3F4"),
      black: recolorSvg(logo.svg, "#0A0A0A"),
    }),
    [logo.svg]
  );

  const scene = { logo, name, variants };

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/90 px-6 py-4 backdrop-blur-sm md:px-12">
        <p className="text-base font-medium">
          {SERVICE_NAME}
          <span className="align-super text-[10px]">®</span>
        </p>
        <div className="flex items-center gap-4">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Brand name"
            className="w-40 rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-sm focus:border-white/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-white/85"
          >
            New logo
          </button>
        </div>
      </header>

      <Hero {...scene} />
      <Construction {...scene} />
      <Palette {...scene} />
      <UsageGrid {...scene} />
      <AppIcons {...scene} />
      <Browser {...scene} />
      <Social {...scene} />
      <Badge {...scene} />

      <footer className="flex items-center justify-between px-6 py-10 md:px-12">
        <p className="font-mono text-xs uppercase text-white/40">
          Generated with {SERVICE_NAME} — working title
        </p>
        <p className="font-mono text-xs uppercase text-white/40">
          {new Date().getFullYear()}
        </p>
      </footer>
    </main>
  );
}
