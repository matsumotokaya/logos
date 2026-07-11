"use client";

// 004 Path Stagger — the mark constructs itself shape by shape.
//
// Each path/shape rises from its own centroid with a small time offset:
// letters of a wordmark appear one after another, elements of a symbol snap
// into place in sequence. transform-box:fill-box makes each element scale
// about its own bounding box, so nothing is distorted and the whole thing
// reads as being *built* rather than faded in.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogoSvg } from "@/lab/core/svg-utils";

gsap.registerPlugin(CustomEase);
const settleEase =
  CustomEase.get("lab-stagger-settle") ??
  CustomEase.create("lab-stagger-settle", "0.22, 1, 0.30, 1");

export default function PathStagger({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !logo.svg) return;

    const { shapes } = mountLogoSvg(stage, logo.svg);
    // Scale each shape about its own centre, not the SVG origin.
    for (const el of shapes) {
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = "50% 50%";
    }

    // Keep the total window steady regardless of shape count: more shapes
    // means tighter spacing rather than a longer animation.
    const each = 0.55;
    const total = 1.8;
    const stagger =
      shapes.length > 1 ? (total - each) / (shapes.length - 1) : 0;

    gsap.set(shapes, { opacity: 0, scale: 0.78 });

    const tl = gsap.timeline({ paused: true });
    tl.to(shapes, {
      opacity: 1,
      scale: 1,
      duration: each,
      ease: settleEase,
      stagger,
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
      <div ref={stageRef} style={{ width: "62%", height: "62%" }} />
    </div>
  );
}
