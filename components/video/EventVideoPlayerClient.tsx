"use client";

// Browser preview of the event promo — @remotion/player runs the same
// EventComposition the CLI renders to MP4, so preview and export match.

import { Player } from "@remotion/player";
import {
  EventComposition,
  EVENT_FPS,
  EVENT_WIDTH,
  EVENT_HEIGHT,
  EVENT_DURATION_FRAMES,
  type EventVideoProps,
} from "@/remotion/event/EventComposition";

export default function EventVideoPlayerClient({ brief }: EventVideoProps) {
  return (
    <Player
      component={EventComposition}
      inputProps={{ brief } satisfies EventVideoProps}
      durationInFrames={EVENT_DURATION_FRAMES}
      fps={EVENT_FPS}
      compositionWidth={EVENT_WIDTH}
      compositionHeight={EVENT_HEIGHT}
      controls
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      acknowledgeRemotionLicense
    />
  );
}
