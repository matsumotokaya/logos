"use client";

import { svgToDataUri } from "@/lib/svg";
import { isDark, hairlineOn } from "@/lib/color";
import { useI18n } from "@/lib/i18n";
import Reveal from "./Reveal";
import { SectionIntro, slugify, type SceneProps } from "./shared";

export default function Social({ logo, name, variants }: SceneProps) {
  const { dict } = useI18n();
  const primary = logo.colors[0].hex;
  const slug = slugify(name);
  const logoOnPrimary = isDark(primary) ? variants.white : variants.black;

  return (
    <section className="flex min-h-dvh flex-col justify-center bg-paper">
      <SectionIntro
        n="07"
        title={dict.scenes.social}
        lead={dict.sections.social.lead}
      />
      <Reveal className="flex justify-center px-6 pb-16 md:px-12 md:pb-24">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-hairline bg-paper shadow-sm">
          {/* Banner — hairline keeps the edge when the primary is near-white. */}
          <div
            className="h-36"
            style={{
              backgroundColor: primary,
              borderBottom: `1px solid ${hairlineOn(primary)}`,
            }}
          />
          <div className="px-6 pb-8">
            <div className="flex">
              <div
                className="-mt-12 flex size-24 items-center justify-center rounded-full border ring-4 ring-paper"
                style={{
                  backgroundColor: primary,
                  borderColor: hairlineOn(primary),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={svgToDataUri(logoOnPrimary)}
                  alt={`${name} profile picture`}
                  className="max-h-[50%] w-1/2 object-contain"
                />
              </div>
              <div
                className="ml-auto mt-3 self-start rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper"
                aria-hidden="true"
              >
                Following
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <p className="text-xl font-semibold text-ink">{name}</p>
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <circle cx="10" cy="10" r="10" fill="#4B9BFF" />
                <path
                  d="M5.8 10.4l2.6 2.6 5.8-5.8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm text-ink-muted">@{slug}</p>
            <p className="mt-3 text-sm text-ink text-pretty">
              {dict.sections.social.bio}
            </p>
            <div className="mt-4 flex gap-6 text-sm">
              <span>
                <b className="font-semibold text-ink tabular-nums">35</b>{" "}
                <span className="text-ink-muted">Following</span>
              </span>
              <span>
                <b className="font-semibold text-ink tabular-nums">210K</b>{" "}
                <span className="text-ink-muted">Followers</span>
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
