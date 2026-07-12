"use client";

// 010 Guideline Reveal — presents the logo as a piece of design documentation.
//
// The mark sits static and centered. Around it, a design-guideline sheet
// draws itself in like a technical drawing: a faint construction grid, the
// mark's bounding box, clear-space dimension ticks at the four edges, and a
// small color-palette legend below. Everything but the logo animates; the
// logo itself is never scaled or distorted.
//
// Coordinate system: the guide SVG uses a 0-100 viewBox stretched to the
// full stage with preserveAspectRatio="none", so "unit == percent of stage".
// The logo box and the HTML label layer are positioned with plain CSS
// percentages in that same 0-100 space, so everything lines up without any
// pixel measurement of the logo's actual geometry.

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { ExperimentProps } from "@/labs/motion/core/experiment-api";
import { mountLogoSvg } from "@/labs/motion/core/svg-utils";

gsap.registerPlugin(CustomEase);
const drawEase =
  CustomEase.get("lab-guideline-draw") ??
  CustomEase.create("lab-guideline-draw", "0.65, 0, 0.15, 1");
const popEase =
  CustomEase.get("lab-guideline-pop") ??
  CustomEase.create("lab-guideline-pop", "0.19, 1, 0.22, 1");

// Bounding box occupies the centered 56% of the stage on both axes.
const BOX_MIN = 22;
const BOX_MAX = 78;
const CLEAR_PCT = BOX_MIN; // margin from stage edge to bbox edge, in "units" (== %)

const GRID_LINES = [20, 40, 60, 80];
const DIM_TICK_HALF = 2;
const DIM_LEN = 6; // how far each clear-space indicator reaches past the bbox edge

export default function GuidelineReveal({
  logo,
  playing,
  replayNonce,
}: ExperimentProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const htmlLayerRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const colors = logo.colors.slice(0, 5);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    const htmlLayer = htmlLayerRef.current;
    if (!stage || !svg || !htmlLayer || !logo.svg) return;

    mountLogoSvg(stage, logo.svg);

    const gridEls = svg.querySelectorAll<SVGLineElement>(
      "[data-guide-grid], [data-guide-axis]",
    );
    const bboxEl = svg.querySelector<SVGRectElement>("[data-guide-bbox]");
    const dimLines = svg.querySelectorAll<SVGLineElement>(
      "[data-guide-dim-line]",
    );
    const dimTicks = svg.querySelectorAll<SVGLineElement>(
      "[data-guide-dim-tick]",
    );
    const dimLabel = htmlLayer.querySelector<HTMLElement>(
      "[data-guide-label]",
    );
    const swatchItems = htmlLayer.querySelectorAll<HTMLElement>(
      "[data-guide-swatch]",
    );

    gsap.set(gridEls, { strokeDashoffset: 100 });
    if (bboxEl) gsap.set(bboxEl, { strokeDashoffset: 100 });
    gsap.set(dimLines, { strokeDashoffset: 100 });
    gsap.set(dimTicks, { opacity: 0 });
    if (dimLabel) gsap.set(dimLabel, { opacity: 0 });
    gsap.set(swatchItems, {
      opacity: 0,
      y: 6,
      scale: 0.85,
      transformOrigin: "50% 50%",
    });

    const tl = gsap.timeline({ paused: true });
    // Stage 1 — construction grid draws in first.
    tl.to(
      gridEls,
      { strokeDashoffset: 0, duration: 0.65, ease: drawEase, stagger: 0.035 },
      0,
    );
    // Stage 2 — the mark's bounding box.
    if (bboxEl) {
      tl.to(
        bboxEl,
        { strokeDashoffset: 0, duration: 0.55, ease: drawEase },
        0.5,
      );
    }
    // Stage 3 — clear-space dimension lines + ticks + numeric label.
    tl.to(
      dimLines,
      { strokeDashoffset: 0, duration: 0.45, ease: drawEase, stagger: 0.06 },
      1.05,
    );
    tl.to(
      dimTicks,
      { opacity: 1, duration: 0.25, ease: "sine.out", stagger: 0.03 },
      1.15,
    );
    if (dimLabel) {
      tl.to(dimLabel, { opacity: 1, duration: 0.3, ease: "sine.out" }, 1.45);
    }
    // Stage 4 — color palette legend.
    tl.to(
      swatchItems,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: popEase,
        stagger: 0.08,
      },
      1.6,
    );

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

  const hairline = "rgba(16,16,18,0.12)";
  const axisline = "rgba(16,16,18,0.18)";
  const dimColor = "rgba(16,16,18,0.35)";
  const labelColor = "rgba(16,16,18,0.55)";
  const accent = "#6C2BFF";

  return (
    <div className="relative h-full w-full bg-white">
      {/* Logo — static, never distorted. Box matches the guide bbox exactly. */}
      <div
        ref={stageRef}
        className="absolute"
        style={{
          left: `${BOX_MIN}%`,
          top: `${BOX_MIN}%`,
          width: `${BOX_MAX - BOX_MIN}%`,
          height: `${BOX_MAX - BOX_MIN}%`,
        }}
      />

      {/* Guide lines — stretched 0-100 viewBox so 1 unit == 1% of stage. */}
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Construction grid */}
        {GRID_LINES.map((x) => (
          <line
            key={`v${x}`}
            data-guide-grid
            x1={x}
            y1={3}
            x2={x}
            y2={83}
            stroke={hairline}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pathLength={100}
            strokeDasharray={100}
          />
        ))}
        {GRID_LINES.map((y) => (
          <line
            key={`h${y}`}
            data-guide-grid
            x1={3}
            y1={y}
            x2={97}
            y2={y}
            stroke={hairline}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pathLength={100}
            strokeDasharray={100}
          />
        ))}
        {/* Center axes, slightly more visible than the grid */}
        <line
          data-guide-axis
          x1={50}
          y1={3}
          x2={50}
          y2={83}
          stroke={axisline}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />
        <line
          data-guide-axis
          x1={3}
          y1={50}
          x2={97}
          y2={50}
          stroke={axisline}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />

        {/* Bounding box */}
        <rect
          data-guide-bbox
          x={BOX_MIN}
          y={BOX_MIN}
          width={BOX_MAX - BOX_MIN}
          height={BOX_MAX - BOX_MIN}
          fill="none"
          stroke={accent}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />

        {/* Clear-space dimension indicators — top / bottom / left / right */}
        {/* Top */}
        <line
          data-guide-dim-line
          x1={50}
          y1={BOX_MIN}
          x2={50}
          y2={BOX_MIN - DIM_LEN}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />
        <line
          data-guide-dim-tick
          x1={50 - DIM_TICK_HALF}
          y1={BOX_MIN}
          x2={50 + DIM_TICK_HALF}
          y2={BOX_MIN}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          data-guide-dim-tick
          x1={50 - DIM_TICK_HALF}
          y1={BOX_MIN - DIM_LEN}
          x2={50 + DIM_TICK_HALF}
          y2={BOX_MIN - DIM_LEN}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* Bottom */}
        <line
          data-guide-dim-line
          x1={50}
          y1={BOX_MAX}
          x2={50}
          y2={BOX_MAX + DIM_LEN}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />
        <line
          data-guide-dim-tick
          x1={50 - DIM_TICK_HALF}
          y1={BOX_MAX}
          x2={50 + DIM_TICK_HALF}
          y2={BOX_MAX}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          data-guide-dim-tick
          x1={50 - DIM_TICK_HALF}
          y1={BOX_MAX + DIM_LEN}
          x2={50 + DIM_TICK_HALF}
          y2={BOX_MAX + DIM_LEN}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* Left */}
        <line
          data-guide-dim-line
          x1={BOX_MIN}
          y1={50}
          x2={BOX_MIN - DIM_LEN}
          y2={50}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />
        <line
          data-guide-dim-tick
          x1={BOX_MIN}
          y1={50 - DIM_TICK_HALF}
          x2={BOX_MIN}
          y2={50 + DIM_TICK_HALF}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          data-guide-dim-tick
          x1={BOX_MIN - DIM_LEN}
          y1={50 - DIM_TICK_HALF}
          x2={BOX_MIN - DIM_LEN}
          y2={50 + DIM_TICK_HALF}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {/* Right */}
        <line
          data-guide-dim-line
          x1={BOX_MAX}
          y1={50}
          x2={BOX_MAX + DIM_LEN}
          y2={50}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
        />
        <line
          data-guide-dim-tick
          x1={BOX_MAX}
          y1={50 - DIM_TICK_HALF}
          x2={BOX_MAX}
          y2={50 + DIM_TICK_HALF}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <line
          data-guide-dim-tick
          x1={BOX_MAX + DIM_LEN}
          y1={50 - DIM_TICK_HALF}
          x2={BOX_MAX + DIM_LEN}
          y2={50 + DIM_TICK_HALF}
          stroke={dimColor}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* HTML layer — text and swatches, kept undistorted regardless of stage aspect ratio. */}
      <div ref={htmlLayerRef} className="pointer-events-none absolute inset-0">
        <div
          data-guide-label
          className="absolute font-mono"
          style={{
            left: "50%",
            top: `${BOX_MIN - DIM_LEN - 1}%`,
            transform: "translate(-50%, -100%)",
            fontSize: "10px",
            letterSpacing: "0.05em",
            color: labelColor,
            whiteSpace: "nowrap",
          }}
        >
          CLEAR SPACE {CLEAR_PCT}%
        </div>

        <div
          className="absolute flex"
          style={{
            left: "50%",
            top: `${BOX_MAX + DIM_LEN + 6}%`,
            transform: "translate(-50%, 0)",
            gap: "10px",
          }}
        >
          {colors.map((c, i) => (
            <div
              key={`${c.hex}-${i}`}
              data-guide-swatch
              className="flex flex-col items-center"
              style={{ gap: "4px" }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  background: c.hex,
                  border: "1px solid rgba(16,16,18,0.18)",
                }}
              />
              <span
                className="font-mono"
                style={{ fontSize: "8px", color: labelColor }}
              >
                {c.hex}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
