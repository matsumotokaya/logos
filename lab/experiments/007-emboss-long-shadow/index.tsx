"use client";

// 007 Emboss / Long Shadow — the mark gains a light source.
//
// A directional shadow is built from a few stacked, low-alpha drop-shadows in
// a neutral ink (they compound into a soft fading trail) plus one longer,
// blurred grounding shadow. The logo is static; only the light angle drifts,
// a few degrees, very slowly — a "still" texture with the faintest life.
//
// Chained drop-shadows re-filter the whole previous result each step, so the
// step count is kept small (≤ 8) to stay cheap to paint. Colour stays
// achromatic per the palette rule. Works for SVG and PNG.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";

const BASE_ANGLE = Math.PI * 0.28; // ~50° down-right

function longShadow(angle: number, len: number, steps: number): string {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const unit = len / steps;
  let filter = "";
  for (let i = 1; i <= steps; i++) {
    filter += ` drop-shadow(${(dx * unit * i).toFixed(1)}px ${(dy * unit * i).toFixed(1)}px 0 rgba(16,16,18,0.07))`;
  }
  // One soft, longer shadow to ground the mark.
  filter += ` drop-shadow(${(dx * len * 1.1).toFixed(1)}px ${(dy * len * 1.1).toFixed(1)}px ${(len * 0.4).toFixed(1)}px rgba(16,16,18,0.12))`;
  return filter.trim();
}

export default function EmbossLongShadow({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    mountLogo(stage, logo);
    const len = Math.max(12, stage.clientWidth * 0.09);
    const steps = 8;

    const proxy = { a: BASE_ANGLE };
    let lastA = NaN;
    const render = () => {
      // Throttle filter rebuilds to meaningful angle changes (paint is costly).
      if (Math.abs(proxy.a - lastA) < 0.006) return;
      lastA = proxy.a;
      stage.style.filter = longShadow(proxy.a, len, steps);
    };
    render();

    const tween = gsap.to(proxy, {
      a: BASE_ANGLE + 0.11,
      duration: 9,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      paused: true,
      onUpdate: render,
    });

    tweenRef.current = tween;
    return () => {
      tween.kill();
      tweenRef.current = null;
      stage.innerHTML = "";
      stage.style.filter = "";
    };
  }, [logo]);

  useEffect(() => {
    tweenRef.current?.restart().pause();
  }, [replayNonce, logo]);

  useEffect(() => {
    const tween = tweenRef.current;
    if (!tween) return;
    if (playing) tween.play();
    else tween.pause();
  }, [playing, replayNonce, logo]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div ref={stageRef} style={{ width: "56%", height: "56%" }} />
    </div>
  );
}
