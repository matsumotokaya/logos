"use client";

// 009 Ambient Background — a slow color-mesh drifting behind a static mark.
//
// A handful of soft, heavily blurred radial-gradient blobs — tinted with the
// logo's own palette at very low opacity — drift and breathe behind the mark
// on long, staggered loops. The mark itself never moves. A white radial
// vignette sits between the blobs and the mark, guaranteeing the mark's
// clear space stays close to pure white so the logo always reads first.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";
import { hexToRgb } from "@/lib/color";

// Fallback when a logo carries no usable color (e.g. a flat black mark).
// Achromatic is allowed by the lab's palette rule.
const NEUTRAL_HEXES = ["#c9c9c9", "#dcdcdc", "#b5b5b5", "#e8e8e8"];

// Anchor positions (% of stage), spread so blobs don't stack on load.
const POSITIONS = [
  { left: "22%", top: "28%" },
  { left: "76%", top: "24%" },
  { left: "28%", top: "76%" },
  { left: "74%", top: "74%" },
];

// Per-blob drift target (self-relative %) and scale delta. Durations are
// staggered so the loops never sync up into one visible "beat".
const DRIFT = [
  { dLeft: 9, dTop: -7, dScale: 0.16, duration: 13 },
  { dLeft: -8, dTop: 8, dScale: -0.14, duration: 16 },
  { dLeft: 7, dTop: 9, dScale: 0.12, duration: 19 },
  { dLeft: -9, dTop: -8, dScale: -0.17, duration: 22 },
];

export default function AmbientBackground({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const tweensRef = useRef<gsap.core.Tween[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    const bg = bgRef.current;
    if (!stage || !bg) return;

    mountLogo(stage, logo);

    // Dominant-first palette from the logo, faded to pastel tints via low
    // alpha. Never invents colors — only the logo's own extracted hexes
    // (or neutral gray) are used.
    const swatches = logo.colors.length
      ? logo.colors.slice(0, 4)
      : NEUTRAL_HEXES.map((hex) => ({ hex, share: 0.25 }));

    bg.innerHTML = "";
    const tweens: gsap.core.Tween[] = [];

    swatches.forEach((swatch, i) => {
      const { r, g, b } = hexToRgb(swatch.hex);
      const pos = POSITIONS[i % POSITIONS.length];
      const drift = DRIFT[i % DRIFT.length];
      // Slightly stronger tint for the more dominant colors, always kept faint.
      const alpha = Math.min(0.1 + swatch.share * 0.14, 0.22);

      const blob = document.createElement("div");
      blob.style.position = "absolute";
      blob.style.left = pos.left;
      blob.style.top = pos.top;
      blob.style.width = "58%";
      blob.style.height = "58%";
      blob.style.borderRadius = "50%";
      blob.style.background = `radial-gradient(circle, rgba(${r},${g},${b},${alpha}) 0%, rgba(${r},${g},${b},0) 70%)`;
      blob.style.filter = "blur(30px)";
      blob.style.willChange = "transform, left, top";
      bg.appendChild(blob);

      // Center the anchor, transform stays fully gsap-owned from here on
      // so later scale/x/y tweens never fight an inline transform string.
      gsap.set(blob, { xPercent: -50, yPercent: -50, scale: 1 });

      const tween = gsap.to(blob, {
        left: `+=${drift.dLeft}%`,
        top: `+=${drift.dTop}%`,
        scale: 1 + drift.dScale,
        duration: drift.duration,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        paused: true,
      });
      tweens.push(tween);
    });

    tweensRef.current = tweens;
    return () => {
      tweens.forEach((t) => t.kill());
      tweensRef.current = [];
      bg.innerHTML = "";
      stage.innerHTML = "";
    };
  }, [logo]);

  useEffect(() => {
    tweensRef.current.forEach((t) => t.restart().pause());
  }, [replayNonce, logo]);

  useEffect(() => {
    tweensRef.current.forEach((t) => (playing ? t.play() : t.pause()));
  }, [playing, replayNonce, logo]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      <div ref={bgRef} className="absolute inset-0" />
      {/* Vignette: keeps the mark's clear space near-white regardless of blob position. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.8) 36%, rgba(255,255,255,0) 64%)",
        }}
      />
      <div
        ref={stageRef}
        className="relative z-10"
        style={{ width: "60%", height: "60%" }}
      />
    </div>
  );
}
