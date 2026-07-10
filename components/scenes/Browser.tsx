"use client";

import { svgToDataUri } from "@/lib/svg";
import { hairlineOn } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, slugify, type SceneProps } from "./shared";

const FAVICON_SIZES = [
  { px: 48, cls: "size-12" },
  { px: 32, cls: "size-8" },
  { px: 16, cls: "size-4" },
] as const;

export default function Browser({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const primary = logo.colors[0].hex;
  const slug = slugify(name);
  // The chrome is always light, so the mark inside it is always the ink variant.
  const inkLogo = svgToDataUri(variants.black);
  const whiteLogo = svgToDataUri(variants.white);

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="06"
        title={dict.scenes.web}
        lead={dict.sections.web.lead}
        slug="web"
      />
      <Reveal className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="grid min-h-[70vh] md:grid-cols-2">
          {/* Brand-primary field with a light browser chrome floating on it. */}
          <div
            className="flex items-center justify-center border p-8 md:p-16"
            style={{
              backgroundColor: primary,
              borderColor: hairlineOn(primary),
            }}
          >
            <div className="w-full max-w-md overflow-hidden rounded-lg bg-[#F4F4F2] shadow-lg">
              {/* Tab strip */}
              <div className="flex items-end gap-2 bg-[#E7E7E4] px-3 pt-2">
                <div
                  className="mr-1 flex gap-2 self-center pb-2"
                  aria-hidden="true"
                >
                  <span className="size-2.5 rounded-full bg-black/15" />
                  <span className="size-2.5 rounded-full bg-black/15" />
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: primary,
                      border: `1px solid ${hairlineOn(primary)}`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-t-md bg-[#F4F4F2] px-4 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inkLogo} alt="" className="size-4" />
                  <span className="text-xs text-ink">{name}</span>
                  <span className="text-xs text-ink-faint" aria-hidden="true">
                    ✕
                  </span>
                </div>
                <span
                  className="self-center pb-2 text-ink-faint"
                  aria-hidden="true"
                >
                  +
                </span>
              </div>
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-faint">
                <span aria-hidden="true">←</span>
                <span aria-hidden="true">→</span>
                <span aria-hidden="true">↻</span>
                <div className="flex flex-1 items-center gap-2 rounded-full bg-black/5 px-4 py-1.5 text-xs text-ink-muted">
                  <svg
                    viewBox="0 0 12 12"
                    className="size-3"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M3.5 5V3.75a2.5 2.5 0 0 1 5 0V5H9a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h.5Zm1.25 0h2.5V3.75a1.25 1.25 0 0 0-2.5 0V5Z" />
                  </svg>
                  www.{slug}.com
                </div>
              </div>
              {/* Viewport */}
              <div className="flex h-44 items-center justify-center bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={inkLogo} alt="" className="h-10 w-auto" />
              </div>
            </div>
          </div>

          {/* Favicon size ramp on the dark artboard. */}
          <div className="flex flex-col items-center justify-center gap-10 bg-plate p-12 md:p-16">
            <p className="font-mono text-xs uppercase text-white/40">
              Favicon — 48 / 32 / 16
            </p>
            <div className="flex items-end gap-8">
              {FAVICON_SIZES.map((f) => (
                <div key={f.px} className="flex flex-col items-center gap-3">
                  <div className="border border-white/10 bg-white/5 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={whiteLogo} alt="" className={f.cls} />
                  </div>
                  <p className="font-mono text-[10px] text-white/40 tabular-nums">
                    {f.px}px
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
