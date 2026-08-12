// One scene on screen.
//
// The stage puts the theme's ground down, arranges the scene's components
// through the layout it asked for, and lets each one arrive on the theme's
// schedule. It never positions anything itself — regions resolve to flex, so a
// component that turned out empty or was dropped by the fitter simply closes
// the layout up.

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { distribute, LAYOUTS, type Scene } from "../layout";
import { fitScene } from "../fit";
import type { Theme } from "../theme";
import { KitComponent } from "./KitComponent";
import { enterDelay, sceneFade } from "./motion";
import type { LayoutSlot } from "../layout";
import type { Emphasis, SceneComponent } from "../components";

const REGION_STYLE: Record<LayoutSlot["region"], React.CSSProperties> = {
  centre: { alignItems: "center", justifyContent: "center", textAlign: "center" },
  left: { alignItems: "flex-start", justifyContent: "center", textAlign: "left" },
  right: { alignItems: "center", justifyContent: "center" },
  "bottom-left": { alignItems: "flex-start", justifyContent: "flex-end", textAlign: "left" },
  "bottom-right": { alignItems: "flex-end", justifyContent: "flex-end", textAlign: "right" },
  full: { alignItems: "stretch", justifyContent: "stretch" },
};

const ALIGN: Record<LayoutSlot["align"], React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  centre: "center",
  end: "flex-end",
};

/** Stage margins. Generous, and the same for every layout: the breathing room
 *  IS the art direction in this kind of film. */
const PAD_X = 132;
const PAD_Y = 96;

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
      {groups.map((components, slotIndex) => {
        const slot = spec.slots[slotIndex];
        const isFull = slot.region === "full";
        return (
          <AbsoluteFill
            key={`${slot.region}-${slotIndex}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: slot.gap,
              padding: isFull ? 0 : `${PAD_Y}px ${PAD_X}px`,
              ...REGION_STYLE[slot.region],
              alignItems: isFull ? "stretch" : ALIGN[slot.align],
              // A split layout uses half the stage per side.
              ...(slot.region === "left" ? { right: "50%" } : {}),
              ...(slot.region === "right" && !fullBleed ? { left: "50%" } : {}),
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
