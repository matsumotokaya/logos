"use client";

// 001 Classic Reveal — the lab's reference experiment.
//
// Outline strokes draw in (staggered per shape), fills fade up as strokes
// dissolve, the whole mark settles with a slight scale-up, then keeps
// drifting +10% over 10 seconds. Quiet by design: every later experiment is
// judged against this one.
//
// Technique note: strokes are drawn on shallow clones inserted next to each
// original shape, so original paint (gradients, existing strokes) is never
// touched — originals simply fade in whole.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogoSvg, safeTotalLength } from "@/lab/core/svg-utils";

gsap.registerPlugin(CustomEase);
const drawEase =
  CustomEase.get("lab-classic-draw") ??
  CustomEase.create("lab-classic-draw", "0.70, 0, 0.18, 1");
const settleEase =
  CustomEase.get("lab-classic-settle") ??
  CustomEase.create("lab-classic-settle", "0.16, 1, 0.30, 1");

export default function ClassicReveal({
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
    const ink = logo.colors[0]?.hex ?? "#101012";

    const originals: SVGGraphicsElement[] = [];
    const clones: SVGGraphicsElement[] = [];
    for (const el of shapes) {
      originals.push(el);
      const len = safeTotalLength(el);
      if (len <= 0) continue;
      const fill = el.getAttribute("fill");
      const strokeColor =
        fill && fill !== "none" && !fill.startsWith("url(")
          ? fill
          : el.getAttribute("stroke") || ink;
      const clone = el.cloneNode(false) as SVGGraphicsElement;
      clone.setAttribute("fill", "none");
      clone.setAttribute("stroke", strokeColor);
      clone.setAttribute("stroke-width", "1.5");
      clone.setAttribute("vector-effect", "non-scaling-stroke");
      clone.setAttribute("stroke-linecap", "round");
      clone.style.strokeDasharray = `${len}`;
      clone.style.strokeDashoffset = `${len}`;
      el.after(clone);
      clones.push(clone);
    }

    gsap.set(originals, { opacity: 0 });
    gsap.set(stage, { scale: 0.97, transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ paused: true });
    // Stage 1 — outline draw, staggered per shape.
    tl.to(
      clones,
      { strokeDashoffset: 0, duration: 1.5, ease: drawEase, stagger: 0.14 },
      0,
    );
    const drawEnd = tl.duration();
    // Stage 2 — fills up, strokes dissolve.
    tl.to(
      originals,
      { opacity: 1, duration: 0.9, ease: "sine.inOut" },
      drawEnd - 0.55,
    );
    tl.to(
      clones,
      { opacity: 0, duration: 0.7, ease: "sine.out" },
      drawEnd - 0.35,
    );
    // Stage 3 — settle with a slight scale-up.
    tl.to(
      stage,
      { scale: 1, duration: 1.0, ease: settleEase },
      drawEnd - 0.55,
    );
    // Stage 4 — slow +10% drift over 10s, then rest.
    tl.to(stage, { scale: 1.1, duration: 10, ease: "power1.inOut" }, ">");

    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      stage.innerHTML = "";
      gsap.set(stage, { clearProps: "all" });
    };
  }, [logo]);

  // Restart on replay, then respect the playing flag.
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
      {/* 62% box = permanent clear space around the mark. */}
      <div ref={stageRef} style={{ width: "62%", height: "62%" }} />
    </div>
  );
}
