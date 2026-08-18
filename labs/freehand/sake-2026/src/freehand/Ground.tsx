// Video and collage grounds, beside Photo.tsx's stills.
//
// A clip plays LOCKED-OFF on purpose: the generated material was prompted to
// hold its camera still because this layer moves one, so if both move the
// frame drifts. For clips, the inherent motion IS the camera move, and this
// layer only grades and darkens.

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { resolveSrc } from "@/remotion/kit/paint";

export const VideoGround: React.FC<{
  src: string;
  opacity?: number;
  grade?: string;
}> = ({ src, opacity = 1, grade }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    <Video
      src={resolveSrc(src)}
      muted
      loop
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity,
        ...(grade ? { filter: grade } : {}),
      }}
    />
  </AbsoluteFill>
);

/**
 * A tiled wall of photographs, drifting slowly sideways.
 *
 * Two rows offset like brickwork, oversized beyond the frame so the drift
 * never shows an edge. The tiles are graded down as one — a collage of
 * eight bright photographs is a checkerboard, and the scene's text still has
 * to win.
 */
export const CollageGround: React.FC<{
  srcs: string[];
  length: number;
  opacity?: number;
}> = ({ srcs, length, opacity = 0.72 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, Math.max(1, length)], [0, -70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const GAP = 10;
  const TILE_W = 560;
  const TILE_H = (1080 - GAP) / 2;
  const perRow = Math.ceil(srcs.length / 2);
  const rows = [srcs.slice(0, perRow), srcs.slice(perRow)];
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity }}>
      <div style={{ transform: `translateX(${drift}px)` }}>
        {rows.map((row, r) => (
          <div
            key={r}
            style={{
              display: "flex",
              gap: GAP,
              marginBottom: GAP,
              // The second row starts half a tile back — brickwork, so the
              // vertical seams do not line up into a grid crosshair.
              marginLeft: r === 1 ? -TILE_W / 2 : 0,
            }}
          >
            {row.map((src, i) => (
              <Img
                key={i}
                src={resolveSrc(src)}
                style={{
                  width: TILE_W,
                  height: TILE_H,
                  objectFit: "cover",
                  // The press photos are already dark interiors; graded UP
                  // slightly, because the collage sits under its own opacity
                  // and the scene's scrim — three darkenings stacked read as
                  // "footage of nothing" (v6 measured exactly that).
                  filter: "saturate(0.88) brightness(1.18)",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
