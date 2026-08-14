// One scene on screen.
//
// The stage puts the theme's ground down, arranges the scene's components
// through the layout it asked for, and lets each one arrive on the theme's
// schedule. It never positions anything itself — regions resolve to flex, so a
// component that turned out empty or was dropped by the fitter simply closes
// the layout up.

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import {
  distribute,
  LAYOUTS,
  REGION_GEOMETRY,
  STAGE,
  type Scene,
  type SceneBackdrop,
} from "../layout";
import { fitScene } from "../fit";
import { focusPosition } from "../paint";
import { captionSafeBottom, type Theme } from "../theme";
import { KitComponent } from "./KitComponent";
import { enterDelay, sceneFade } from "./motion";
import type { LayoutSlot } from "../layout";
import type { Emphasis, SceneComponent } from "../components";

const ALIGN: Record<LayoutSlot["align"], React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  centre: "center",
  end: "flex-end",
};

/**
 * The photograph a scene stands on.
 *
 * Cover, framed at the brief's focus point, dimmed by the theme, pushed slowly
 * for the length of the scene and covered by a scrim. The push is what keeps a
 * still photograph from reading as a paused video; the scrim is what lets any
 * photograph — including a bright one nobody art-directed — carry type.
 */
const Backdrop: React.FC<{
  backdrop: SceneBackdrop;
  theme: Theme;
  length: number;
}> = ({ backdrop, theme, length }) => {
  const frame = useCurrentFrame();
  const [from, to] = theme.backdrop.push;
  return (
    <AbsoluteFill>
      <Img
        src={backdrop.photo.src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: focusPosition(backdrop.photo),
          opacity: theme.backdrop.opacity[backdrop.weight],
          transform: `scale(${interpolate(frame, [0, Math.max(length, 1)], [from, to], {
            extrapolateRight: "clamp",
          })})`,
        }}
      />
      <AbsoluteFill style={{ background: theme.backdrop.scrim }} />
    </AbsoluteFill>
  );
};

export const Stage: React.FC<{
  scene: Scene;
  theme: Theme;
  /** Frames this scene holds — decided upstream by the narration timeline. */
  length: number;
}> = ({ scene, theme, length }) => {
  const frame = useCurrentFrame();
  const spec = LAYOUTS[scene.layout];

  // The fitter decides how loudly each component is set and which ones cannot
  // be set at all. Running it here, at draw time, means the same brief always
  // produces the same stage — no state to fall out of date.
  const fitted = fitScene(scene.components, theme);
  const emphasisFor = new Map<SceneComponent, Emphasis>(
    fitted.placed.map((item) => [item.component, item.emphasis]),
  );
  const kept: Scene = {
    ...scene,
    components: fitted.placed.map((item) => item.component),
  };
  const groups = distribute(kept);

  let order = 0;
  const fullBleed = spec.slots.some((slot) => slot.region === "full");

  return (
    <AbsoluteFill style={{ opacity: sceneFade(theme, frame, length) }}>
      {scene.backdrop ? (
        <Backdrop backdrop={scene.backdrop} theme={theme} length={length} />
      ) : null}
      {groups.map((components, slotIndex) => {
        const slot = spec.slots[slotIndex];
        const geometry = REGION_GEOMETRY[slot.region];
        const isFull = geometry.bleed;
        return (
          <AbsoluteFill
            key={`${slot.region}-${slotIndex}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: slot.gap,
              padding: isFull ? 0 : `${STAGE.padY}px ${STAGE.padX}px`,
              // The subtitle band owns the bottom of the frame; a region that
              // stacks against the bottom edge stops above it (theme.ts).
              ...(geometry.justifyContent === "flex-end" && !isFull
                ? { paddingBottom: captionSafeBottom(theme) }
                : {}),
              justifyContent: geometry.justifyContent,
              textAlign: geometry.textAlign,
              alignItems: isFull ? "stretch" : ALIGN[slot.align],
              // A split layout uses half the stage per side.
              ...(geometry.half === "left" ? { right: "50%" } : {}),
              ...(geometry.half === "right" && !fullBleed ? { left: "50%" } : {}),
            }}
          >
            {components.map((component, i) => (
              <KitComponent
                key={`${component.kind}-${slotIndex}-${i}`}
                component={component}
                theme={theme}
                emphasis={emphasisFor.get(component) ?? "secondary"}
                delay={enterDelay(order++)}
              />
            ))}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
