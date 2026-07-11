"use client";

// 005 Particle Assemble — scattered particles gather into the logo.
//
// The logo is rasterized and grid-sampled; each opaque sample becomes a
// particle carrying that pixel's own colour (so the palette rule holds
// automatically). Particles start scattered and ease to their targets with a
// small distance-based stagger, then the crisp logo is drawn on top so the
// resting state is sharp — never a stippled approximation.
//
// Canvas work is driven by a plain rAF loop (no GSAP). Time only advances
// while `playing`; `replayNonce` resets to the scattered state.

import { useEffect, useRef } from "react";
import type { ExperimentProps } from "@/lab/core/experiment-api";
import { logoToImage } from "@/lab/core/svg-utils";

type Particle = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  color: string;
  delay: number; // 0..0.35 of the gather window
};

const DURATION = 2000; // ms
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function ParticleAssemble({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  const elapsedRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    elapsedRef.current = 0;
  }, [replayNonce, logo]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    let particles: Particle[] = [];
    let img: HTMLImageElement | null = null;
    let dstRect = { x: 0, y: 0, w: 0, h: 0 };
    let cssW = 0;
    let cssH = 0;

    const setup = async () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = wrap.clientWidth;
      cssH = wrap.clientHeight;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const loaded = await logoToImage(logo);
      if (cancelled) return;
      img = loaded;

      // Contain-fit the logo into a centred 62% clear-space box.
      const boxW = cssW * 0.62;
      const boxH = cssH * 0.62;
      const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      dstRect = { x: (cssW - w) / 2, y: (cssH - h) / 2, w, h };

      // Sample opaque pixels off an offscreen raster of the fitted logo.
      const off = document.createElement("canvas");
      off.width = cssW;
      off.height = cssH;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(img, dstRect.x, dstRect.y, w, h);
      const data = octx.getImageData(0, 0, cssW, cssH).data;

      // Grid step tuned so we land on ~2500 particles for any canvas size.
      const opaque: { x: number; y: number; c: string }[] = [];
      let step = Math.max(3, Math.round(Math.min(w, h) / 46));
      for (let attempt = 0; attempt < 4; attempt++) {
        opaque.length = 0;
        for (let y = 0; y < cssH; y += step) {
          for (let x = 0; x < cssW; x += step) {
            const i = (y * cssW + x) * 4;
            if (data[i + 3] > 90) {
              opaque.push({
                x,
                y,
                c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
              });
            }
          }
        }
        if (opaque.length <= 3200) break;
        step += 1;
      }

      const cx = cssW / 2;
      const cy = cssH / 2;
      const spread = Math.max(cssW, cssH);
      particles = opaque.map((p) => {
        const ang = Math.random() * Math.PI * 2;
        const dist = spread * (0.4 + Math.random() * 0.7);
        return {
          sx: cx + Math.cos(ang) * dist,
          sy: cy + Math.sin(ang) * dist,
          tx: p.x,
          ty: p.y,
          color: p.c,
          delay: Math.random() * 0.35,
        };
      });
      elapsedRef.current = 0;

      const dot = Math.max(1.5, step * 0.72);
      let last = performance.now();

      const frame = (now: number) => {
        if (cancelled) return;
        const dt = now - last;
        last = now;
        if (playingRef.current) elapsedRef.current += dt;
        const t = clamp01(elapsedRef.current / DURATION);

        ctx.clearRect(0, 0, cssW, cssH);
        if (t >= 1 && img) {
          // Resting state: crisp logo.
          ctx.drawImage(img, dstRect.x, dstRect.y, dstRect.w, dstRect.h);
        } else {
          for (const p of particles) {
            const local = clamp01((t - p.delay) / (1 - p.delay));
            const e = easeOutCubic(local);
            const x = p.sx + (p.tx - p.sx) * e;
            const y = p.sy + (p.ty - p.sy) * e;
            ctx.globalAlpha = Math.min(1, local * 1.6);
            ctx.fillStyle = p.color;
            ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
          }
          ctx.globalAlpha = 1;
        }
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    };

    void setup();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [logo, replayNonce]);

  return (
    <div
      ref={wrapRef}
      className="flex h-full w-full items-center justify-center bg-white"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
