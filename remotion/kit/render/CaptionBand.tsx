// The subtitle band.
//
// Always drawn, never a scene's decision: most people watch this kind of film
// with the sound off, so a film whose words exist only as audio says nothing
// to them. It sits above every scene and below nothing.
//
// The scrim is a gradient rather than a box because a hard plate cuts the
// picture in half; a gradient darkens what is behind the letters and leaves
// the frame whole.

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../theme";
import { captionAt, type Caption } from "@/remotion/event-cm/captions";

/** Frames a caption takes to appear. Short: a subtitle that fades slowly
 *  reads as an effect, and the eye is already at the next line. */
const FADE = 4;

export const CaptionBand: React.FC<{ captions: Caption[]; theme: Theme }> = ({
  captions,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const caption = captionAt(captions, nowMs);
  if (!caption) return null;

  const startFrame = (caption.fromMs / 1000) * fps;
  const endFrame = (caption.toMs / 1000) * fps;
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + FADE, Math.max(startFrame + FADE + 1, endFrame - FADE), endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      {theme.caption.backdrop === "scrim" ? (
        <AbsoluteFill
          style={{
            top: "auto",
            height: theme.caption.bottom + theme.caption.size * 3.4,
            background: `linear-gradient(to top, ${theme.palette.ground}cc 0%, ${theme.palette.ground}00 100%)`,
            opacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          marginBottom: theme.caption.bottom,
          maxWidth: 1440,
          padding: "0 96px",
          textAlign: "center",
          fontFamily: theme.textFont,
          fontSize: theme.caption.size,
          lineHeight: 1.55,
          letterSpacing: "0.04em",
          color: theme.caption.color,
          textShadow:
            theme.caption.backdrop === "shadow"
              ? `0 2px 12px ${theme.palette.ground}, 0 0 32px ${theme.palette.ground}`
              : undefined,
          opacity,
        }}
      >
        {caption.text}
      </div>
    </AbsoluteFill>
  );
};
