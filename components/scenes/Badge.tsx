"use client";

import { svgToDataUri } from "@/lib/svg";
import { darken, isDark } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, slugify, type SceneProps } from "./shared";

/**
 * Flat card field derived from the primary, darkened until the white
 * knockout and type are guaranteed to read on it.
 */
function darkField(primary: string): string {
  let bg = darken(primary, 0.35);
  for (let f = 0.45; !isDark(bg) && f <= 0.95; f += 0.1) {
    bg = darken(primary, f);
  }
  return bg;
}

export default function Badge({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const slug = slugify(name);
  const field = darkField(logo.colors[0].hex);
  const year = new Date().getFullYear();

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="08"
        title={dict.scenes.onsite}
        lead={dict.sections.onsite.lead}
      />
      <Reveal className="flex flex-col items-center px-6 pb-16 md:px-12 md:pb-24">
        {/* Lanyard strap */}
        <div className="flex flex-col items-center" aria-hidden="true">
          <div className="h-16 w-7" style={{ backgroundColor: field }} />
          <div className="-mt-1 mb-2 size-4 rounded-full border-2 border-ink-faint" />
        </div>
        {/* Badge card — flat field, no gradient. */}
        <div
          className="flex aspect-[10/15] w-72 flex-col rounded-2xl p-6 shadow-xl"
          style={{ backgroundColor: field, color: "#F4F4F2" }}
        >
          <div className="mb-5 h-1.5 w-10 self-center rounded-full bg-black/40" />
          <div className="flex items-start justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.white)}
              alt={`${name} logo`}
              className="h-5 w-auto"
            />
            <p className="font-mono text-[9px] uppercase opacity-70 tabular-nums">
              {year} {name}
            </p>
          </div>
          <div className="flex-1" />
          <p className="font-display text-3xl font-medium leading-[1.05]">
            Alex
            <br />
            Morgan
          </p>
          <p className="mt-2 text-xs opacity-90">Lead Brand Designer</p>
          <p className="mt-4 font-mono text-[10px] leading-relaxed opacity-75">
            alex.morgan@{slug}.com
            <br />@{slug}
            <br />
            +1 415 555 0198
          </p>
          <div className="mt-5 flex justify-between border-t border-white/20 pt-3 font-mono text-[9px] uppercase opacity-60">
            <span>www.{slug}.com</span>
            <span>Staff</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
