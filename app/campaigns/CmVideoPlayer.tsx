"use client";

// Browser preview of the 30s CM — @remotion/player runs the same
// CmComposition the CLI renders to MP4, so preview and export are pixel
// identical. Loaded lazily (next/dynamic in campaign-ui) because Remotion is
// a heavy dependency that only campaign pages with a finished voice track
// need.

import { Player } from "@remotion/player";
import {
  CmComposition,
  CM_FPS,
  CM_WIDTH,
  CM_HEIGHT,
  cmDurationInFrames,
  type CmVideoProps,
} from "@/remotion/cm/CmComposition";

export default function CmVideoPlayer({ kit, track, audioSrc }: CmVideoProps) {
  return (
    <Player
      component={CmComposition}
      inputProps={{ kit, track, audioSrc } satisfies CmVideoProps}
      durationInFrames={cmDurationInFrames(track)}
      fps={CM_FPS}
      compositionWidth={CM_WIDTH}
      compositionHeight={CM_HEIGHT}
      controls
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      acknowledgeRemotionLicense
    />
  );
}
