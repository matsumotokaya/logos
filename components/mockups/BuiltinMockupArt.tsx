"use client";

import { darken, hairlineOn, isDark, luminance } from "@/lib/color";
import { svgToDataUri } from "@/lib/svg";
import {
  isDeviceMockupKind,
  type BuiltinMockupKind,
} from "@/lib/presentation-mockups";
import { slugify, type SceneProps } from "@/components/scenes/shared";
import DeviceMockupBuilder from "@/components/mockups/DeviceMockupBuilder";

const TSHIRT_PRINT = { left: 41.5, top: 36, width: 16 };

function darkField(primary: string): string {
  let bg = darken(primary, 0.35);
  for (let f = 0.45; !isDark(bg) && f <= 0.95; f += 0.1) {
    bg = darken(primary, f);
  }
  return bg;
}

export default function BuiltinMockupArt({
  kind,
  scene,
  className,
}: {
  kind: BuiltinMockupKind;
  scene: SceneProps;
  className?: string;
}) {
  if (isDeviceMockupKind(kind)) {
    return <DeviceMockupBuilder kind={kind} scene={scene} className={className} />;
  }

  switch (kind) {
    case "social-card":
      return <SocialCardArt scene={scene} className={className} />;
    case "staff-badge":
      return <BadgeArt scene={scene} className={className} />;
    case "tshirt":
      return <TShirtArt scene={scene} className={className} />;
    default:
      return null;
  }
}

function SocialCardArt({
  scene: { logo, name, variants },
  className,
}: {
  scene: SceneProps;
  className?: string;
}) {
  const primary = logo.colors[0].hex;
  const slug = slugify(name);
  const logoOnPrimary = isDark(primary) ? variants.white : variants.black;

  return (
    <div className={className}>
      <div className="w-full overflow-hidden rounded-xl border border-hairline bg-paper shadow-sm">
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
            Official account. One logo, every asset.
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
    </div>
  );
}

function BadgeArt({
  scene: { logo, name, variants },
  className,
}: {
  scene: SceneProps;
  className?: string;
}) {
  const slug = slugify(name);
  const field = darkField(logo.colors[0].hex);
  const year = new Date().getFullYear();

  return (
    <div className={className}>
      <div className="flex flex-col items-center" aria-hidden="true">
        <div className="h-16 w-7" style={{ backgroundColor: field }} />
        <div className="-mt-1 mb-2 size-4 rounded-full border-2 border-ink-faint" />
      </div>
      <div
        className="mx-auto flex aspect-[10/15] w-72 max-w-full flex-col rounded-2xl p-6 shadow-xl"
        style={{ backgroundColor: field, color: "#F4F4F2" }}
      >
        <div className="mb-5 h-1.5 w-10 self-center rounded-full bg-black/40" />
        <div className="flex items-start justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgToDataUri(variants.white)}
            alt={`${name} logo`}
            className="h-5 w-auto"
          />
          <p className="font-mono text-[9px] uppercase opacity-70 tabular-nums">
            {year} {name}
          </p>
        </div>
        <div className="flex-1" />
        <p className="font-display text-3xl font-medium leading-[1.05]">
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
  );
}

function TShirtArt({
  scene: { logo, name, variants },
  className,
}: {
  scene: SceneProps;
  className?: string;
}) {
  const primary = logo.colors[0].hex;
  const printSvg = luminance(primary) > 0.85 ? variants.black : logo.svg;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl border border-hairline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mockups/tshirt-white.jpg"
          alt={`${name} logo printed on a white t-shirt`}
          className="w-full"
        />
        <div
          className="absolute"
          style={{
            left: `${TSHIRT_PRINT.left}%`,
            top: `${TSHIRT_PRINT.top}%`,
            width: `${TSHIRT_PRINT.width}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgToDataUri(printSvg)}
            alt=""
            className="w-full mix-blend-multiply opacity-90"
          />
        </div>
      </div>
    </div>
  );
}
