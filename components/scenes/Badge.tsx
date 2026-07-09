import { svgToDataUri } from "@/lib/svg";
import { darken } from "@/lib/color";
import { Caption, slugify, type SceneProps } from "./shared";

export default function Badge({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const slug = slugify(name);

  return (
    <section className="flex min-h-[90vh] flex-col bg-[#050505] px-6 py-16 md:px-12">
      <Caption n="07" title="On-site" />
      <div className="flex flex-1 flex-col items-center justify-center pt-8">
        {/* Lanyard strap */}
        <div className="flex flex-col items-center" aria-hidden>
          <div
            className="h-16 w-7"
            style={{ background: darken(primary, 0.2) }}
          />
          <div className="-mt-1 mb-2 size-4 rounded-full border-2 border-white/25" />
        </div>
        {/* Badge card */}
        <div
          className="flex aspect-[10/15] w-72 flex-col rounded-2xl p-6 shadow-2xl"
          style={{
            background: `linear-gradient(165deg, #0B0B10 0%, ${darken(primary, 0.1)} 100%)`,
            color: "#F1F3F4",
          }}
        >
          <div className="mb-5 h-1.5 w-10 self-center rounded-full bg-black/40" />
          <div className="flex items-start justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgToDataUri(variants.white)}
              alt=""
              className="h-5 w-auto"
            />
            <p className="font-mono text-[9px] uppercase opacity-70">
              2026 {name}
            </p>
          </div>
          <div className="flex-1" />
          <p className="text-3xl font-medium leading-[1.05]">
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
      </div>
    </section>
  );
}
