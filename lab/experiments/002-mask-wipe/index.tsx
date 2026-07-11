"use client";

// 002 Mask Wipe — directional soft-edge wipe reveal (left → right).
//
// A soft gradient mask sweeps across the mark so it materializes edge-first.
// The logo itself never scales, rotates or distorts — only the mask moves.
// Quiet and architectural; reads as a wipe (not a fade) thanks to the narrow
// soft band between opaque and transparent.
//
// The mask position is driven through an onUpdate proxy rather than tweened
// as a compound CSS value, so it stays reliable across browsers and the
// production (Turbopack) build.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";

gsap.registerPlugin(CustomEase);
const wipeEase =
  CustomEase.get("lab-wipe") ??
  CustomEase.create("lab-wipe", "0.62, 0, 0.14, 1");

// Opaque up to 42%, fully transparent past 60%: the 18% soft band is the
// visible wiping edge. Oversized to 260% so a single position sweep clears
// the whole mark.
const MASK =
  "linear-gradient(90deg, #000 0%, #000 42%, rgba(0,0,0,0) 60%, rgba(0,0,0,0) 100%)";

export default function MaskWipe({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    mountLogo(stage, logo);
    const applyMask = (posPct: number) => {
      stage.style.webkitMaskPosition = `${posPct}% 0%`;
      stage.style.maskPosition = `${posPct}% 0%`;
    };
    gsap.set(stage, {
      webkitMaskImage: MASK,
      maskImage: MASK,
      webkitMaskSize: "260% 100%",
      maskSize: "260% 100%",
      webkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    });
    applyMask(100); // start fully wiped out

    const proxy = { p: 100 };
    const tl = gsap.timeline({ paused: true });
    tl.to(proxy, {
      p: 0,
      duration: 1.9,
      ease: wipeEase,
      onUpdate: () => applyMask(proxy.p),
    });

    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      stage.innerHTML = "";
      gsap.set(stage, { clearProps: "all" });
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
      <div ref={stageRef} style={{ width: "62%", height: "62%" }} />
    </div>
  );
}
