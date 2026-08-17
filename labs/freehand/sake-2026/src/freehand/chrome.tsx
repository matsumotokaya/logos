// The frame around the film: letterbox, grain, vignette, gold dust, captions.
//
// The letterbox is the single cheapest move that makes a slideshow read as a
// film — it declares an aspect ratio somebody chose. Captions live inside the
// bottom bar, so they never fight the picture and never need a black plate.

import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "@/remotion/event-cm/captions";
import { FH, LETTERBOX } from "./palette";

export const Letterbox: React.FC = () => (
  <>
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: LETTERBOX,
        background: "#040302",
        zIndex: 40,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: LETTERBOX,
        background: "#040302",
        zIndex: 40,
      }}
    />
  </>
);

/** Soft darkening toward the frame edges. Sits over every scene. */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 130% 105% at 50% 46%, transparent 55%, rgba(5,3,2,0.5) 100%)",
      zIndex: 20,
      pointerEvents: "none",
    }}
  />
);

/** Static film grain with a gentle flicker. Texture, not effect. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = 0.045 + random(`grain-${Math.floor(frame / 2)}`) * 0.02;
  return (
    <AbsoluteFill style={{ zIndex: 21, pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="fh-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#fh-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Gold dust drifting upward. Deterministic; quiet; for the ink scenes. */
export const GoldDust: React.FC<{ count?: number; opacity?: number }> = ({
  count = 26,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const dots = Array.from({ length: count }, (_, i) => {
    const seed = (k: string) => random(`dust-${i}-${k}`);
    const speed = 0.25 + seed("v") * 0.5;
    const drift = Math.sin((frame * 0.01 + seed("p") * 10) * (0.6 + seed("w"))) * 30;
    const x = seed("x") * width + drift;
    const y = ((seed("y") * height - frame * speed) % (height + 40) + height + 40) % (height + 40) - 20;
    const r = 1 + seed("r") * 2.4;
    const a = (0.16 + seed("a") * 0.4) * opacity;
    const twinkle = 0.75 + Math.sin(frame * 0.06 + seed("t") * 20) * 0.25;
    return { x, y, r, a: a * twinkle };
  });
  return (
    <AbsoluteFill style={{ zIndex: 5, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={FH.goldBright} opacity={d.a} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

/** Subtitles set in mincho inside the bottom letterbox bar. */
export const FreehandCaptions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const current = captions.find((c) => ms >= c.fromMs && ms < c.toMs);
  if (!current) return null;
  const inMs = ms - current.fromMs;
  const outMs = current.toMs - ms;
  const opacity =
    interpolate(inMs, [0, 180], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(outMs, [0, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: LETTERBOX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: FH.font,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "0.06em",
          color: FH.paper,
        }}
      >
        {current.text}
      </span>
    </div>
  );
};
