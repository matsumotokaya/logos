import { Caption, type SceneProps } from "./shared";
import { hexToRgb, rgbToCmyk, textOn, type RGB } from "@/lib/color";

type Band = {
  name: string;
  hex: string;
  rgb: RGB;
  cmyk: [number, number, number, number];
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

export default function Palette({ logo }: SceneProps) {
  const bands: Band[] = logo.colors.map((c, i) => ({
    name: EXTRACTED_NAMES[i] ?? `Accent 0${i + 1}`,
    hex: c.hex,
    rgb: c.rgb,
    cmyk: c.cmyk,
  }));

  const extracted = new Set(logo.colors.map((c) => c.hex.toUpperCase()));
  for (const neutral of NEUTRALS) {
    if (extracted.has(neutral.hex.toUpperCase())) continue;
    const rgb = hexToRgb(neutral.hex);
    bands.push({ name: neutral.name, hex: neutral.hex, rgb, cmyk: rgbToCmyk(rgb) });
  }

  return (
    <section className="bg-background">
      <div className="px-6 py-16 md:px-12">
        <Caption n="02" title="Color" />
      </div>
      {bands.map((band, i) => (
        <div
          key={`${band.hex}-${band.name}`}
          className={`flex items-start justify-between px-6 py-10 md:px-16 ${
            i === 0 ? "min-h-[38vh]" : "min-h-[22vh]"
          }`}
          style={{ background: band.hex, color: textOn(band.hex) }}
        >
          <p className="text-sm font-medium uppercase">{band.name}</p>
          <dl className="grid grid-cols-[auto_auto] gap-x-10 gap-y-1 font-mono text-xs tabular-nums">
            <dt className="opacity-60">HEX</dt>
            <dd>{band.hex}</dd>
            <dt className="opacity-60">RGB</dt>
            <dd>{`${band.rgb.r}, ${band.rgb.g}, ${band.rgb.b}`}</dd>
            <dt className="opacity-60">CMYK</dt>
            <dd>{band.cmyk.join(", ")}</dd>
          </dl>
        </div>
      ))}
    </section>
  );
}
