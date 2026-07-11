"use client";

// 015 Lottie Roundtrip — fidelity check for exporting a motion to Lottie.
//
// A representative move (fade + scale settle) is shown twice, side by side:
//   left  = code execution (gsap)
//   right = the same move authored as a Lottie JSON and played by lottie-web
// Both use the SAME easing (cubic-bezier 0.16,1,0.30,1) so any drift is the
// format's, not the tuning's. The logo is rasterized to a PNG and embedded as
// a Lottie image asset, so any uploaded logo can make the roundtrip.
//
// This is a verification harness, not a presentation effect: it tells us which
// experiments can be carried into Lottie and what is lost (blur/particles/3D
// cannot; raster embedding fixes the resolution at export time).

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { AnimationItem } from "lottie-web";
import type { ExperimentProps, LabLogo } from "@/lab/core/experiment-api";
import { mountLogo, logoToImage } from "@/lab/core/svg-utils";

gsap.registerPlugin(CustomEase);
// Shared easing. Lottie bezier handles below use the same control points:
// out-tangent (0.16, 1) and in-tangent (0.30, 1).
const settleEase =
  CustomEase.get("lab-lottie-settle") ??
  CustomEase.create("lab-lottie-settle", "0.16, 1, 0.30, 1");

const FR = 30;
const FADE_END = 18; // 0.6s
const SETTLE_END = 60; // 2.0s
const OUT = 75; // 2.5s loop

/** Rasterize a logo to a transparent PNG data URI for Lottie image embedding. */
async function logoToPng(
  logo: LabLogo,
): Promise<{ uri: string; w: number; h: number }> {
  const img = await logoToImage(logo);
  const max = 512;
  const scale = max / Math.max(img.naturalWidth, img.naturalHeight, 1);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(img, 0, 0, w, h);
  return { uri: canvas.toDataURL("image/png"), w, h };
}

/** Build a minimal Lottie doc: one centered image, fade-in + scale settle. */
function buildLottie(uri: string, w: number, h: number) {
  const bezIn = { x: [0.3], y: [1] };
  const bezOut = { x: [0.16], y: [1] };
  return {
    v: "5.7.0",
    fr: FR,
    ip: 0,
    op: OUT,
    w,
    h,
    assets: [{ id: "logo", w, h, u: "", p: uri, e: 1 }],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 2, // image
        refId: "logo",
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [0], i: bezIn, o: bezOut },
              { t: FADE_END, s: [100] },
            ],
          },
          p: { a: 0, k: [w / 2, h / 2, 0] },
          a: { a: 0, k: [w / 2, h / 2, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [86, 86, 100], i: bezIn, o: bezOut },
              { t: SETTLE_END, s: [100, 100, 100] },
            ],
          },
        },
        ip: 0,
        op: OUT,
        st: 0,
        bm: 0,
      },
    ],
  };
}

export default function LottieRoundtrip({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const codeRef = useRef<HTMLDivElement>(null);
  const lottieBox = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Code version (gsap).
  useEffect(() => {
    const stage = codeRef.current;
    if (!stage) return;
    mountLogo(stage, logo);
    gsap.set(stage, { transformOrigin: "50% 50%" });

    const tl = gsap.timeline({ paused: true, repeat: -1 });
    tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: settleEase }, 0);
    tl.fromTo(stage, { scale: 0.86 }, { scale: 1, duration: 2.0, ease: settleEase }, 0);
    tl.to({}, { duration: 0.5 }); // pad to 2.5s before looping

    tlRef.current = tl;
    return () => {
      tl.kill();
      tlRef.current = null;
      stage.innerHTML = "";
      gsap.set(stage, { clearProps: "all" });
    };
  }, [logo]);

  // Lottie version (lottie-web).
  useEffect(() => {
    let cancelled = false;
    const box = lottieBox.current;
    if (!box) return;

    const setup = async () => {
      const { uri, w, h } = await logoToPng(logo);
      if (cancelled || !lottieBox.current) return;
      const lottie = (await import("lottie-web")).default;
      if (cancelled || !lottieBox.current) return;
      lottieBox.current.innerHTML = "";
      const anim = lottie.loadAnimation({
        container: lottieBox.current,
        renderer: "svg",
        loop: true,
        autoplay: false,
        animationData: buildLottie(uri, w, h),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      animRef.current = anim;
      // The play/pause effect may have already run while this async load was in
      // flight; honor the current state so the Lottie side doesn't sit at frame 0.
      if (playingRef.current) anim.play();
    };
    void setup();

    return () => {
      cancelled = true;
      animRef.current?.destroy();
      animRef.current = null;
      if (box) box.innerHTML = "";
    };
  }, [logo]);

  // Restart both together.
  useEffect(() => {
    tlRef.current?.restart().pause();
    animRef.current?.goToAndStop(0, true);
  }, [replayNonce, logo]);

  // Play/pause both together.
  useEffect(() => {
    const tl = tlRef.current;
    const anim = animRef.current;
    if (playing) {
      tl?.play();
      anim?.play();
    } else {
      tl?.pause();
      anim?.pause();
    }
  }, [playing, replayNonce, logo]);

  return (
    <div className="grid h-full w-full grid-cols-2 bg-white">
      <Pane label="コード実行版 (gsap)">
        <div ref={codeRef} style={{ width: "62%", height: "62%" }} />
      </Pane>
      <Pane label="Lottie 版 (lottie-web)" divider>
        <div ref={lottieBox} style={{ width: "62%", height: "62%" }} />
      </Pane>
    </div>
  );
}

function Pane({
  label,
  divider,
  children,
}: {
  label: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex items-center justify-center ${divider ? "border-l border-hairline" : ""}`}
    >
      <span className="absolute top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}
