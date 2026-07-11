"use client";

// 011 Lockup Variations — the mark + wordmark cycle through three lockups.
//
// The bundled test logos are single flattened SVGs (symbol and wordmark are
// not separate assets), so a "lockup" here is defined as the mark (rendered
// whole via mountLogo) paired with logo.name as a text wordmark. The two
// elements are absolutely positioned inside a shared stage and a gsap
// timeline tweens their position/size/opacity between three arrangements:
// stacked, horizontal, and symbol-only. Everything eases with power3, never
// linear, and the mark is always resized via a box that keeps its own
// aspect ratio — mountLogo's contain-fit inside that box guarantees the
// mark itself is never stretched.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { mountLogo } from "@/lab/core/svg-utils";

type Frame = {
  markLeft: number;
  markTop: number;
  markHeight: number;
  textLeft: number;
  textTop: number;
  textSize: number;
  textOpacity: number;
};

const HOLD = 2.4;
const TRANS = 1.05;
const EASE = "power3.inOut";

export default function LockupVariations({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const markWrap = markRef.current;
    const textEl = textRef.current;
    if (!canvas || !markWrap || !textEl) return;

    mountLogo(markWrap, logo);
    // Use the brand name only: drop any trailing qualifier the built-in test
    // logos carry, e.g. "Halo(シンボル型)" -> "Halo".
    textEl.textContent = logo.name.replace(/[（(].*$/, "").trim() || logo.name;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const aspect = logo.viewBox.w / logo.viewBox.h || 1;
    const textSize = Math.max(14, h * 0.09);

    // Mark box height per layout — width is derived from the logo's own
    // aspect ratio so mountLogo's contain-fit never has to letterbox or
    // stretch the mark.
    const stack: Frame = {
      markLeft: w * 0.5,
      markTop: h * 0.36,
      markHeight: h * 0.34,
      textLeft: w * 0.5,
      textTop: h * 0.78,
      textSize,
      textOpacity: 1,
    };
    const horizontal: Frame = {
      markLeft: w * 0.32,
      markTop: h * 0.5,
      markHeight: h * 0.46,
      textLeft: w * 0.68,
      textTop: h * 0.5,
      textSize,
      textOpacity: 1,
    };
    const symbol: Frame = {
      markLeft: w * 0.5,
      markTop: h * 0.5,
      markHeight: h * 0.62,
      textLeft: w * 0.5,
      textTop: h * 0.5,
      textSize,
      textOpacity: 0,
    };

    const markVars = (f: Frame) => ({
      left: f.markLeft,
      top: f.markTop,
      height: f.markHeight,
      width: f.markHeight * aspect,
    });
    const textVars = (f: Frame) => ({
      left: f.textLeft,
      top: f.textTop,
      fontSize: f.textSize,
      opacity: f.textOpacity,
    });

    gsap.set(markWrap, { ...markVars(stack), xPercent: -50, yPercent: -50 });
    gsap.set(textEl, { ...textVars(stack), xPercent: -50, yPercent: -50 });

    const tl = gsap.timeline({ paused: true, repeat: -1 });

    // stack -> horizontal
    tl.to({}, { duration: HOLD });
    tl.to(markWrap, { ...markVars(horizontal), duration: TRANS, ease: EASE });
    tl.to(
      textEl,
      { ...textVars(horizontal), duration: TRANS, ease: EASE },
      "<",
    );

    // horizontal -> symbol
    tl.to({}, { duration: HOLD });
    tl.to(markWrap, { ...markVars(symbol), duration: TRANS, ease: EASE });
    tl.to(textEl, { ...textVars(symbol), duration: TRANS, ease: EASE }, "<");

    // symbol -> stack (loop point)
    tl.to({}, { duration: HOLD });
    tl.to(markWrap, { ...markVars(stack), duration: TRANS, ease: EASE });
    tl.to(textEl, { ...textVars(stack), duration: TRANS, ease: EASE }, "<");

    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      markWrap.innerHTML = "";
      textEl.textContent = "";
      gsap.set([markWrap, textEl], { clearProps: "all" });
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
      <div
        ref={canvasRef}
        className="relative"
        style={{ width: "84%", height: "68%" }}
      >
        <div ref={markRef} className="absolute" />
        <div
          ref={textRef}
          className="absolute whitespace-nowrap font-display font-medium tracking-tight text-ink"
        />
      </div>
    </div>
  );
}
