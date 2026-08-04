// Remotion root for the CLI / Studio (the in-app <Player> imports
// CmComposition directly and never goes through this file). Props are
// supplied per render via --props (see labs/campaign/scripts/render-cm.mjs);
// without props the composition renders an empty canvas.

import React from "react";
import { Composition } from "remotion";
import {
  CmComposition,
  CM_FPS,
  CM_WIDTH,
  CM_HEIGHT,
  cmDurationInFrames,
  type CmVideoProps,
} from "./cm/CmComposition";
// Relative imports on purpose — the Remotion CLI's webpack does not resolve
// the "@/" tsconfig alias.
import type { CampaignBrandKit } from "../lib/campaign/schema";
import type { CmVoiceTrack } from "../lib/campaign/cm-types";
import {
  EventComposition,
  EVENT_FPS,
  EVENT_WIDTH,
  EVENT_HEIGHT,
  EVENT_DURATION_FRAMES,
} from "./event/EventComposition";
import { sake2026Brief } from "./event/briefs/sake-2026";

type NullableProps = {
  kit: CampaignBrandKit | null;
  track: CmVoiceTrack | null;
  audioSrc: string | null;
  bgmSrc: string | null;
};

const CmOrEmpty: React.FC<NullableProps> = ({ kit, track, audioSrc, bgmSrc }) => {
  if (!kit || !track) {
    return null;
  }
  return <CmComposition {...({ kit, track, audioSrc, bgmSrc } satisfies CmVideoProps)} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="cm"
      component={CmOrEmpty}
      fps={CM_FPS}
      width={CM_WIDTH}
      height={CM_HEIGHT}
      durationInFrames={300}
      defaultProps={{
        kit: null as CampaignBrandKit | null,
        track: null as CmVoiceTrack | null,
        audioSrc: null as string | null,
        bgmSrc: null as string | null,
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.track ? cmDurationInFrames(props.track) : 300,
        props,
      })}
    />
    {/* Event promo template. The bundled sake-2026 brief doubles as default
        props so `remotion studio` / `remotion render` work with no --props;
        a per-event render passes its own brief the same way the CM does. */}
    <Composition
      id="event"
      component={EventComposition}
      fps={EVENT_FPS}
      width={EVENT_WIDTH}
      height={EVENT_HEIGHT}
      durationInFrames={EVENT_DURATION_FRAMES}
      defaultProps={{ brief: sake2026Brief }}
    />
    </>
  );
};
