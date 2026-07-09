import { svgToDataUri } from "@/lib/svg";
import { Caption, slugify, type SceneProps } from "./shared";

export default function Browser({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const slug = slugify(name);
  const whiteLogo = svgToDataUri(variants.white);

  return (
    <section>
      <div className="bg-background px-6 pt-16 pb-8 md:px-12">
        <Caption n="05" title="Web" />
      </div>
      <div className="grid min-h-[90vh] md:grid-cols-2">
        {/* Left: brand color field with floating browser chrome */}
        <div
          className="flex items-center justify-center p-8 md:p-16"
          style={{ background: primary }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-[#17181C] shadow-2xl">
            {/* Tab strip */}
            <div className="flex items-end gap-2 bg-[#0E0F12] px-3 pt-2">
              <div className="mr-1 flex gap-2 self-center pb-2" aria-hidden>
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: primary }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-t-lg bg-[#17181C] px-4 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={whiteLogo} alt="" className="size-4" />
                <span className="text-xs text-white/80">{name}</span>
                <span className="text-xs text-white/30" aria-hidden>
                  ✕
                </span>
              </div>
              <span className="self-center pb-2 text-white/30" aria-hidden>
                +
              </span>
            </div>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/40">
              <span aria-hidden>←</span>
              <span aria-hidden>→</span>
              <span aria-hidden>↻</span>
              <div className="flex flex-1 items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 text-xs text-white/70">
                <svg
                  viewBox="0 0 12 12"
                  className="size-3"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M3.5 5V3.75a2.5 2.5 0 0 1 5 0V5H9a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h.5Zm1.25 0h2.5V3.75a1.25 1.25 0 0 0-2.5 0V5Z" />
                </svg>
                www.{slug}.com
              </div>
            </div>
            {/* Viewport */}
            <div className="flex h-44 items-center justify-center bg-[#101114]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={whiteLogo} alt="" className="h-10 w-auto opacity-90" />
            </div>
          </div>
        </div>

        {/* Right: favicon size ramp */}
        <div className="flex flex-col items-center justify-center gap-10 bg-[#050505] p-12 md:p-16">
          <p className="font-mono text-xs uppercase text-white/40">
            Favicon — 48 / 32 / 16
          </p>
          <div className="flex items-end gap-8">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={whiteLogo} alt="" className="size-12" />
              </div>
              <p className="font-mono text-[10px] text-white/40 tabular-nums">
                48px
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={whiteLogo} alt="" className="size-8" />
              </div>
              <p className="font-mono text-[10px] text-white/40 tabular-nums">
                32px
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={whiteLogo} alt="" className="size-4" />
              </div>
              <p className="font-mono text-[10px] text-white/40 tabular-nums">
                16px
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
