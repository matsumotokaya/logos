"use client";

// 008 Breathing — a resident, barely-perceptible scale loop.
//
// The mark swells and settles by ~2.5%, uniformly, on a slow symmetric ease.
// It should sit at the threshold of perception: the logo feels alive without
// any read of "animation". For presentation idle states / holding screens.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";

export default function Breathing({
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
    gsap.set(stage, { scale: 1, transformOrigin: "50% 50%" });

    const tween = gsap.to(stage, {
      scale: 1.025,
      duration: 4.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      paused: true,
    });

    tweenRef.current = tween;
    return () => {
      tween.kill();
      tweenRef.current = null;
      stage.innerHTML = "";
      gsap.set(stage, { clearProps: "all" });
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
      <div ref={stageRef} style={{ width: "62%", height: "62%" }} />
    </div>
  );
}
