import React from "react";
import { Composition } from "remotion";
import {
  EventCmComposition,
  eventCmDurationInFrames,
  EVENT_FPS,
  EVENT_WIDTH,
  EVENT_HEIGHT,
} from "@/remotion/event-cm/EventCmComposition";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import briefJson from "../props.json";

const brief = briefJson as unknown as EventCmBrief;

export const Root: React.FC = () => (
  <Composition
    id="event-cm"
    component={EventCmComposition}
    fps={EVENT_FPS}
    width={EVENT_WIDTH}
    height={EVENT_HEIGHT}
    durationInFrames={eventCmDurationInFrames(brief)}
    defaultProps={{ brief }}
    calculateMetadata={({ props }) => ({
      durationInFrames: eventCmDurationInFrames(props.brief),
      props,
    })}
  />
);
