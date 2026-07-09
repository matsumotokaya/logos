import { Caption, type SceneProps } from "./shared";
import { svgToDataUri } from "@/lib/svg";
import { isDark } from "@/lib/color";

export default function AppIcons({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const onPrimary = isDark(primary) ? variants.white : variants.black;

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
              className="max-h-[50%] w-1/2 object-contain"
            />
          </div>
          <p className="mt-3 text-center text-sm text-white/80">{name}</p>
        </div>
        <div>
          <div className="flex size-24 items-center justify-center rounded-[22.5%] bg-[#F1F3F4]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(logo.svg)}
              alt=""
              className="max-h-[50%] w-1/2 object-contain"
            />
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tabular-nums text-white/40">
            #F1F3F4
          </p>
        </div>
        <div>
          <div className="flex size-24 items-center justify-center rounded-[22.5%] bg-[#000000] ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.white)}
              alt=""
              className="max-h-[50%] w-1/2 object-contain"
            />
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tabular-nums text-white/40">
            #000000
          </p>
        </div>
        <div>
          <div
            className="flex size-24 items-center justify-center rounded-[22.5%]"
            style={{ background: primary }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(onPrimary)}
              alt=""
              className="max-h-[50%] w-1/2 object-contain"
            />
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tabular-nums text-white/40">
            {primary}
          </p>
        </div>
      </div>
    </section>
  );
}
