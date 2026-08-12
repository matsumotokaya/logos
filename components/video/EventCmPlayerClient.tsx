"use client";

// Browser preview of the narrated event promo — the same composition the CLI
// renders to MP4, so preview and export match.

import { Player } from "@remotion/player";
import {
  EventCmComposition,
  eventCmDurationInFrames,
  EVENT_FPS,
  EVENT_WIDTH,
  EVENT_HEIGHT,
  type EventCmVideoProps,
} from "@/remotion/event-cm/EventCmComposition";

export default function EventCmPlayerClient({ brief }: EventCmVideoProps) {
  return (
    <Player
      component={EventCmComposition}
      inputProps={{ brief } satisfies EventCmVideoProps}
      durationInFrames={eventCmDurationInFrames(brief)}
      fps={EVENT_FPS}
      compositionWidth={EVENT_WIDTH}
      compositionHeight={EVENT_HEIGHT}
      controls
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      acknowledgeRemotionLicense
    />
  );
}
