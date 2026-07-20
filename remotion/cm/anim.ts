// Small animation helpers for the CM composition (adapted from the xtrust
// concept video). CSS transitions/animations don't render in Remotion —
// everything derives from useCurrentFrame() + interpolate()/spring().

import { interpolate, Easing, spring } from "remotion";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Springy scale pop — for badges, marks, small accents. */
export const pop = (
  frame: number,
  fps: number,
  delay = 0,
  config?: Parameters<typeof spring>[0]["config"]
): number =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, mass: 0.6, ...config },
  });

/** Signature entrance: spring rise with a slight overshoot (cards, headlines). */
export const springEnter = (
  frame: number,
  fps: number,
  delay = 0
): { opacity: number; translateY: number; scale: number } => {
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 90 },
  });
  return {
    opacity: interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
    translateY: interpolate(s, [0, 1], [42, 0]),
    scale: interpolate(s, [0, 1], [0.94, 1]),
  };
};

/** Horizontal scale wipe 0→1 over `duration` frames from `delay`. */
export const wipeIn = (frame: number, delay: number, duration: number): number =>
  interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
