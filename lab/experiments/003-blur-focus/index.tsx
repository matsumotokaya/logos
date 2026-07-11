"use client";

// 003 Blur Focus — the mark resolves out of a soft blur.
//
// Starts heavily blurred, slightly oversized and transparent, then pulls into
// focus while settling to 1:1. Like a lens finding focus. Scale is strictly
// uniform (never distorts the logo); blur is proportional to the canvas width
// so a card and the fullscreen modal read identically.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";

gsap.registerPlugin(CustomEase);
const focusEase =
  CustomEase.get("lab-focus") ??
  CustomEase.create("lab-focus", "0.16, 1, 0.30, 1");

export default function BlurFocus({
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
    // Blur scaled to the canvas so the effect is size-independent.
    const startBlur = Math.max(8, stage.clientWidth * 0.09);

    gsap.set(stage, {
      opacity: 0,
      scale: 1.06,
      filter: `blur(${startBlur}px)`,
      transformOrigin: "50% 50%",
    });

    const tl = gsap.timeline({ paused: true });
    tl.to(stage, {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      duration: 2.1,
      ease: focusEase,
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
