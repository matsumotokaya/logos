// Graphic-equalizer band along the bottom edge, driven by the real narration
// audio (adapted from the xtrust concept video). Mirrored bars (low freqs in
// the center) as subtle ambient motion — settles flat when nobody speaks.
//
// `frame` is passed from the parent (not useCurrentFrame) so the windowed
// audio analysis stays continuous regardless of sibling <Sequence> offsets.

import React from "react";
import { useVideoConfig } from "remotion";
import { useWindowedAudioData, visualizeAudio } from "@remotion/media-utils";
import type { CmPalette } from "./palette";

const EQ_BARS = 64; // power of 2 for visualizeAudio

export const Equalizer: React.FC<{
  frame: number;
  audioSrc: string;
  pal: CmPalette;
}> = ({ frame, audioSrc, pal }) => {
  const { fps } = useVideoConfig();
  const { audioData, dataOffsetInSeconds } = useWindowedAudioData({
    src: audioSrc,
    frame,
    fps,
    windowInSeconds: 30,
  });

  if (!audioData) return null;

  const frequencies = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: EQ_BARS,
    optimizeFor: "speed",
    dataOffsetInSeconds,
  });

  // Mirror so lows sit in the center, highs spread outward.
  const half = frequencies.slice(0, EQ_BARS / 2);
  const mirrored = [...[...half].reverse(), ...half];

  const barTop = pal.dark ? "rgba(255,255,255,0.05)" : `${pal.primary}18`;
  const barBottom = pal.dark ? "rgba(255,255,255,0.5)" : `${pal.primary}aa`;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 240,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 4,
        padding: "0 80px",
        pointerEvents: "none",
      }}
    >
      {mirrored.map((v, i) => {
        // Boost so quiet speech still reaches up the frame, clamp at full.
        const h = Math.min(1, v * 3.2);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h * 100}%`,
              minHeight: 3,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${barTop} 0%, ${barBottom} 100%)`,
            }}
          />
        );
      })}
    </div>
  );
};
