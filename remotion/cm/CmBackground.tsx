// Persistent animated backdrop rendered ONCE behind every scene (outside the
// per-scene <Sequence>) so the world keeps moving across cuts. Adapted from
// the xtrust concept video's Background, re-tinted from the campaign palette
// so it works on both the dark (glass) and light (flat) canvases.
//
// Layers: palette-tinted base → two slow-drifting glows → rising dust
// particles → periodic diagonal light sweep.

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CM_WIDTH, CM_HEIGHT, type CmPalette } from "./palette";

const PARTICLE_COUNT = 26;
const SWEEP_PERIOD = 460; // frames between diagonal light sweeps

export const CmBackground: React.FC<{ pal: CmPalette }> = ({ pal }) => {
  const frame = useCurrentFrame();

  // Two soft glows orbiting on slow Lissajous paths.
  const glow1X = CM_WIDTH * 0.5 + Math.sin(frame * 0.006) * 420;
  const glow1Y = CM_HEIGHT * 0.35 + Math.cos(frame * 0.0045) * 180;
  const glow2X = CM_WIDTH * 0.5 + Math.cos(frame * 0.005 + 2) * 520;
  const glow2Y = CM_HEIGHT * 0.66 + Math.sin(frame * 0.004 + 1) * 200;

  const sweepX = ((frame % SWEEP_PERIOD) / SWEEP_PERIOD) * (CM_WIDTH * 1.7) - CM_WIDTH * 0.45;

  const particleColor = pal.dark ? "#ffffff" : pal.primary;
  const sweepAlpha = pal.dark ? 0.05 : 0.03;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: pal.canvas }}>
      {/* Primary glow — brand primary */}
      <div
        style={{
          position: "absolute",
          left: glow1X - 700,
          top: glow1Y - 700,
          width: 1400,
          height: 1400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${pal.primary}${pal.dark ? "3d" : "24"} 0%, ${pal.primary}00 63%)`,
        }}
      />
      {/* Secondary glow — brand accent */}
      <div
        style={{
          position: "absolute",
          left: glow2X - 600,
          top: glow2Y - 600,
          width: 1200,
          height: 1200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${pal.accent}${pal.dark ? "38" : "20"} 0%, ${pal.accent}00 65%)`,
        }}
      />

      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        // Deterministic pseudo-random spread; particles rise and sway.
        const seedX = (i * 733) % CM_WIDTH;
        const size = 3 + (i % 5) * 2.5;
        const speed = 0.25 + (i % 4) * 0.12;
        const y = CM_HEIGHT + 60 - ((frame * speed + i * 211) % (CM_HEIGHT + 260));
        const x = seedX + Math.sin(frame * 0.012 + i * 1.7) * 42;
        const opacity = (0.06 + (i % 4) * 0.03) * (pal.dark ? 1 : 0.7);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: particleColor,
              opacity,
            }}
          />
        );
      })}

      {/* Periodic diagonal light sweep */}
      <div
        style={{
          position: "absolute",
          top: -300,
          left: sweepX,
          width: 560,
          height: CM_HEIGHT + 620,
          transform: "rotate(18deg)",
          background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${sweepAlpha}) 50%, rgba(255,255,255,0) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
