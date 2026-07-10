"use client";

import { SectionIntro, type SceneProps } from "./shared";
import { svgToDataUri } from "@/lib/svg";
import { isDark, hairlineOn } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";

export default function UsageGrid({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const primary = logo.colors[0].hex;
  // Contrast-safe mono variant for the brand-primary field.
  const monoOnPrimary = isDark(primary) ? variants.white : variants.black;

  const tiles: {
    caption: string;
    bg: string;
    svg: string;
    alt: string;
  }[] = [
    {
      caption: "Full color / Light",
      bg: "#FFFFFF",
      svg: logo.svg,
      alt: `${name} logo, full color on light`,
    },
    {
      caption: "Mono / Primary",
      bg: primary,
      svg: monoOnPrimary,
      alt: `${name} logo, mono on primary`,
    },
    {
      caption: "Mono / Dark",
      bg: "#0A0A0B",
      svg: variants.white,
      alt: `${name} logo, mono on dark`,
    },
    {
      caption: "Mono / Light",
      bg: "#F4F4F2",
      svg: variants.black,
      alt: `${name} logo, mono on light`,
    },
  ];

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="04"
        title={dict.scenes.usage}
        lead={dict.sections.usage.lead}
        slug="usage"
      />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.caption}>
              <div
                className="flex aspect-[4/3] items-center justify-center overflow-hidden border"
                style={{
                  backgroundColor: tile.bg,
                  // Keep the frame visible on any field, including a
                  // brand primary close to white or black.
                  borderColor: hairlineOn(tile.bg),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={svgToDataUri(tile.svg)}
                  alt={tile.alt}
                  className="max-h-[55%] w-1/2 object-contain"
                />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase text-ink-muted">
                {tile.caption}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
