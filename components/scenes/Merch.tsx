"use client";

import { svgToDataUri } from "@/lib/svg";
import { luminance } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, type SceneProps } from "./shared";

// Chest print area on public/mockups/tshirt-white.jpg (3:2, shirt centered on hanger).
const PRINT = { left: 41.5, top: 36, width: 16 };

export default function Merch({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const primary = logo.colors[0].hex;
  // Very light logos would vanish in a multiply blend on white fabric.
  const printSvg = luminance(primary) > 0.85 ? variants.black : logo.svg;

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="09"
        title={dict.scenes.merch}
        lead={dict.sections.merch.lead}
        slug="merch"
      />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="relative overflow-hidden border border-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mockups/tshirt-white.jpg"
            alt={`${name} logo printed on a white t-shirt`}
            className="w-full"
          />
          <div
            className="absolute"
            style={{
              left: `${PRINT.left}%`,
              top: `${PRINT.top}%`,
              width: `${PRINT.width}%`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(printSvg)}
              alt=""
              className="w-full mix-blend-multiply opacity-90"
            />
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase text-ink-muted">
          {dict.sections.merch.caption}
        </p>
      </Reveal>
    </section>
  );
}
