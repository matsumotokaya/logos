"use client";

// 006 Gradient Sweep — a single metallic highlight crosses the mark.
//
// The logo sits static. A diagonal white light-band, masked to the logo's
// own silhouette and blended with `screen`, sweeps across exactly once to
// suggest sheen. Deliberately restrained: a hint of gloss, not a flash.
//
// The silhouette mask uses the logo's data URI, so both SVG and PNG work.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo, logoDataUri } from "@/lab/core/svg-utils";

const BAND =
  "linear-gradient(105deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0) 58%)";

export default function GradientSweep({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const sheen = sheenRef.current;
    if (!stage || !sheen) return;

    mountLogo(stage, logo);

    // Mask the sheen layer to the logo silhouette.
    const uri = `url("${logoDataUri(logo)}")`;
    sheen.style.webkitMaskImage = uri;
    sheen.style.maskImage = uri;
    sheen.style.webkitMaskSize = "contain";
    sheen.style.maskSize = "contain";
    sheen.style.webkitMaskRepeat = "no-repeat";
    sheen.style.maskRepeat = "no-repeat";
    sheen.style.webkitMaskPosition = "center";
    sheen.style.maskPosition = "center";
    sheen.style.backgroundImage = BAND;
    sheen.style.backgroundRepeat = "no-repeat";
    sheen.style.backgroundSize = "220% 100%";
    sheen.style.mixBlendMode = "screen";

    const apply = (posPct: number) => {
      sheen.style.backgroundPosition = `${posPct}% 0%`;
    };
    apply(140); // band starts off to the right

    const proxy = { p: 140 };
    const tl = gsap.timeline({ paused: true });
    tl.to({}, { duration: 0.4 }); // brief settle before the sweep
    tl.to(proxy, {
      p: -40,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => apply(proxy.p),
    });

    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      stage.innerHTML = "";
    };
  }, [logo]);

  useEffect(() => {
    tlRef.current?.restart().pause();
  }, [replayNonce, logo]);

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (playing) tl.play();
    else tl.pause();
  }, [playing, replayNonce, logo]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="relative" style={{ width: "62%", height: "62%" }}>
        <div ref={stageRef} className="absolute inset-0" />
        <div ref={sheenRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
