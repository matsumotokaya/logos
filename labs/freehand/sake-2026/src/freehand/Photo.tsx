// Full-bleed photography with a camera move.
//
// The template used photographs as a dimmed "ground" (opacity 0.22 under a
// scrim) — the photography was effectively invisible. Here the photograph IS
// the scene: near-full opacity, a slow deliberate move, and darkness applied
// only where type needs it (directional scrims), never over the whole frame.

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { resolveSrc } from "@/remotion/kit/paint";

export interface CameraMove {
  scaleFrom: number;
  scaleTo: number;
  /** Horizontal drift in % of frame width (positive = image moves right). */
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
}

export const Photo: React.FC<{
  src: string;
  /** Scene length in frames — the move spans exactly this. */
  length: number;
  move: CameraMove;
  focus?: { x: number; y: number } | null;
  opacity?: number;
  /** Extra filter, e.g. "saturate(0.9)" for a quieter grade. */
  grade?: string;
}> = ({ src, length, move, focus, opacity = 1, grade }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, Math.max(1, length)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = move.scaleFrom + (move.scaleTo - move.scaleFrom) * t;
  const x = (move.xFrom ?? 0) + ((move.xTo ?? 0) - (move.xFrom ?? 0)) * t;
  const y = (move.yFrom ?? 0) + ((move.yTo ?? 0) - (move.yFrom ?? 0)) * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={resolveSrc(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: focus
            ? `${focus.x * 100}% ${focus.y * 100}%`
            : "50% 50%",
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          opacity,
          ...(grade ? { filter: grade } : {}),
        }}
      />
    </AbsoluteFill>
  );
};

/** A directional darkening so type can sit on photography without killing it. */
export const Scrim: React.FC<{
  side: "left" | "right" | "bottom" | "top" | "radial";
  strength?: number;
  /** How far the gradient reaches, in % (default 72). */
  reach?: number;
}> = ({ side, strength = 0.62, reach = 72 }) => {
  const ink = (a: number) => `rgba(8,6,4,${a})`;
  const background =
    side === "radial"
      ? `radial-gradient(ellipse 120% 90% at 50% 45%, transparent 40%, ${ink(strength)} 100%)`
      : `linear-gradient(to ${side === "left" ? "right" : side === "right" ? "left" : side === "bottom" ? "top" : "bottom"}, ${ink(strength)} 0%, ${ink(strength * 0.55)} ${Math.round(reach * 0.45)}%, transparent ${reach}%)`;
  return <AbsoluteFill style={{ background }} />;
};
