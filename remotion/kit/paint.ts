// How a mark and a photograph are painted, wherever they are painted.
//
// One definition for the renderer (KitComponent, Stage) and for the storyboard
// (components/video/Storyboard.tsx). The storyboard's claim to honesty is that
// a mark and a photograph look the way the film will draw them — that holds
// only while both read the same conversion, so the conversion lives here and
// nowhere else.

import type { LogoTreatment } from "@/remotion/event/types";

/**
 * How a mark is made legible on the stage it lands on.
 *
 * `knockout` is the default wherever a default is needed, rather than `invert`,
 * because inverting a mark that was already light breaks it just as badly as
 * drawing a dark one raw on the ink ground.
 */
export const TREATMENT_FILTER: Record<LogoTreatment, string | undefined> = {
  light: undefined,
  invert: "invert(1)",
  knockout: "brightness(0) invert(1)",
};

/** Focus point of a photo as CSS object-position. Absent focus is the centre. */
export const focusPosition = (photo: {
  focus?: { x: number; y: number };
}): string => `${(photo.focus?.x ?? 0.5) * 100}% ${(photo.focus?.y ?? 0.5) * 100}%`;
