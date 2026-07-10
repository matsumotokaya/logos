"use client";

import { SectionIntro, type SceneProps } from "./shared";
import { hexToRgb, rgbToCmyk, textOn, hairlineOn, type RGB } from "@/lib/color";
import { svgToDataUri } from "@/lib/svg";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";

type Band = {
  name: string;
  hex: string;
  rgb: RGB;
  cmyk: [number, number, number, number];
  /** Visual weight within the mark (0..1). Absent for added neutrals. */
  share?: number;
};

const EXTRACTED_NAMES = [
  "Primary",
  "Secondary",
  "Tertiary",
  "Accent 04",
  "Accent 05",
];

const NEUTRALS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#000000" },
  { name: "Off-White", hex: "#F1F3F4" },
];

export default function Palette({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();

  const bands: Band[] = logo.colors.map((c, i) => ({
    name: EXTRACTED_NAMES[i] ?? `Accent 0${i + 1}`,
    hex: c.hex,
    rgb: c.rgb,
    cmyk: c.cmyk,
    share: c.share,
  }));

  const extracted = new Set(logo.colors.map((c) => c.hex.toUpperCase()));
  for (const neutral of NEUTRALS) {
    if (extracted.has(neutral.hex.toUpperCase())) continue;
    const rgb = hexToRgb(neutral.hex);
    bands.push({ name: neutral.name, hex: neutral.hex, rgb, cmyk: rgbToCmyk(rgb) });
  }

  // Logo variant that contrasts with a given band background.
  const contrastLogo = (hex: string) =>
    textOn(hex) === "#F1F3F4" ? variants.white : variants.black;

  return (
    <section className="bg-paper">
      <Reveal>
        <SectionIntro
          n="03"
          title={dict.scenes.color}
          lead={dict.sections.color.lead}
        />
      </Reveal>

      {/* Full-bleed color bands — the color surfaces themselves are the exhibit. */}
      {bands.map((band, i) => (
        <div
          key={`${band.hex}-${band.name}`}
          className={`flex items-center justify-between gap-6 px-6 py-10 md:px-12 ${
            i === 0 ? "min-h-[40vh]" : "min-h-[22vh]"
          }`}
          style={{
            background: band.hex,
            color: textOn(band.hex),
            borderTop: `1px solid ${hairlineOn(band.hex)}`,
          }}
        >
          <div className="flex items-center gap-8">
            {i === 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={svgToDataUri(contrastLogo(band.hex))}
                alt={`${name} logo on the primary color`}
                className="hidden h-14 w-auto md:block"
              />
            )}
            <p className="font-mono text-xs uppercase">{band.name}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-10 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="opacity-60">HEX</dt>
            <dd>{band.hex.toUpperCase()}</dd>
            <dt className="opacity-60">RGB</dt>
            <dd>{`${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}`}</dd>
            <dt className="opacity-60">CMYK</dt>
            <dd>{band.cmyk.join(", ")}</dd>
            {band.share !== undefined && (
              <>
                <dt className="opacity-60">SHARE</dt>
                <dd>{`${Math.round(band.share * 100)}%`}</dd>
              </>
            )}
          </dl>
        </div>
      ))}
    </section>
  );
}
