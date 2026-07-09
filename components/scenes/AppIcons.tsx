import { Caption, type SceneProps } from "./shared";
import { svgToDataUri } from "@/lib/svg";
import { isDark } from "@/lib/color";

export default function AppIcons({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const onPrimary = isDark(primary) ? variants.white : variants.black;

  // Small variant tiles, deduped by background so a monochrome logo
  // (whose primary color is black or white) doesn't repeat a tile.
  const smallSpecs = [
    { bg: "#F1F3F4", svg: logo.svg, caption: "#F1F3F4" },
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
    <section className="bg-[#050505] px-6 py-16 md:px-12">
      <Caption n="04" title="App icon" />
      <div className="mt-12 flex flex-wrap items-end gap-12">
        <div>
          <div
            className="flex size-40 items-center justify-center rounded-[22.5%] shadow-xl md:size-56"
            style={{ background: primary }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(onPrimary)}
              alt=""
              className="max-h-[58%] w-[64%] object-contain"
            />
          </div>
          <p className="mt-3 text-center text-sm text-white/80">{name}</p>
        </div>
        {small.map((s) => (
          <div key={s.caption + s.bg}>
            <div
              className="flex size-28 items-center justify-center rounded-[22.5%] ring-1 ring-white/10"
              style={{ background: s.bg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgToDataUri(s.svg)}
                alt=""
                className="max-h-[58%] w-[62%] object-contain"
              />
            </div>
            <p className="mt-2 text-center font-mono text-[10px] tabular-nums text-white/40">
              {s.caption}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
