import { Caption, type SceneProps } from "./shared";
import { svgToDataUri } from "@/lib/svg";
import { isDark } from "@/lib/color";

export default function UsageGrid({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const monoOnPrimary = isDark(primary) ? variants.white : variants.black;

  return (
    <section className="bg-background px-6 py-16 md:px-12">
      <Caption n="03" title="Logo usage" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#F1F3F4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(logo.svg)}
              alt={`${name} logo`}
              className="max-h-[45%] w-[38%] object-contain"
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
            Full color / Light
          </p>
        </div>
        <div>
          <div
            className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg"
            style={{ background: primary }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(monoOnPrimary)}
              alt=""
              className="max-h-[45%] w-[38%] object-contain"
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
            Mono / Primary
          </p>
        </div>
        <div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#0A0A0A] ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.white)}
              alt=""
              className="max-h-[45%] w-[38%] object-contain"
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
            Mono / Dark
          </p>
        </div>
        <div>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#FFFFFF]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.black)}
              alt=""
              className="max-h-[45%] w-[38%] object-contain"
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
            Mono / Light
          </p>
        </div>
      </div>
    </section>
  );
}
