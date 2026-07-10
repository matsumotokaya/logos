"use client";

import { SectionIntro, type SceneProps } from "./shared";
import { svgToDataUri } from "@/lib/svg";
import { isDark } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";

export default function AppIcons({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const primary = logo.colors[0].hex;
  // Contrast-safe mono variant for the brand-primary tile.
  const onPrimary = isDark(primary) ? variants.white : variants.black;

  // Small variant tiles, deduped by background so a monochrome logo
  // (whose primary color is black or white) doesn't repeat a tile.
  const smallSpecs = [
    { bg: "#F4F4F2", svg: logo.svg, caption: "#F4F4F2" },
    { bg: "#000000", svg: variants.white, caption: "#000000" },
    { bg: primary, svg: onPrimary, caption: primary.toUpperCase() },
  ];
  const seen = new Set<string>();
  const small = smallSpecs.filter((s) => {
    const k = s.bg.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="05"
        title={dict.scenes.appIcon}
        lead={dict.sections.appIcon.lead}
      />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="flex flex-wrap items-end gap-12">
          <div>
            <div
              className="flex size-40 items-center justify-center rounded-[22.5%] shadow-lg md:size-56"
              style={{ backgroundColor: primary }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgToDataUri(onPrimary)}
                alt={`${name} app icon`}
                className="max-h-[58%] w-[64%] object-contain"
              />
            </div>
            <p className="mt-3 text-center text-sm text-ink">{name}</p>
          </div>
          {small.map((s) => (
            <div key={s.bg.toUpperCase()}>
              <div
                className={
                  // Hairline frame keeps light tiles legible on the paper base.
                  isDark(s.bg)
                    ? "flex size-28 items-center justify-center rounded-[22.5%]"
                    : "flex size-28 items-center justify-center rounded-[22.5%] border border-hairline"
                }
                style={{ backgroundColor: s.bg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={svgToDataUri(s.svg)}
                  alt=""
                  className="max-h-[58%] w-[62%] object-contain"
                />
              </div>
              <p className="mt-2 text-center font-mono text-[10px] text-ink-muted tabular-nums">
                {s.caption}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
