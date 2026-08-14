// The narrated event promo.
//
// Built entirely from the component kit (remotion/kit): the scenes are
// arrangements of vocabulary components, painted by a theme that the brand's
// own palette and typography feed into. Nothing in this file positions
// anything or picks a font.
//
// This replaces the previous version, which sequenced event-promo's
// hand-composed scene components. Those were good, and their judgments were
// kept — they live in the kit's components now, where a second template can
// reach them and a brand's values can change them.
//
// The spine is still the narration: scene order comes from the script's roles
// and scene length from the timeline, which sharpens from budget to script to
// measured voice (timeline.ts).

import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { EventBackground } from "@/remotion/event/EventBackground";
import { resolveMediaSrc } from "@/remotion/event/EventComposition";
import { EVENT_FPS, EVENT_HEIGHT, EVENT_WIDTH } from "@/remotion/event/palette";
import { Stage } from "@/remotion/kit/render/Stage";
import { CaptionBand } from "@/remotion/kit/render/CaptionBand";
import { eventCmFilm } from "./film";
import { msToFrame, msToFrames } from "./timeline";
import type { EventCmBrief } from "./types";

export { EVENT_FPS, EVENT_WIDTH, EVENT_HEIGHT };

export type EventCmVideoProps = {
  brief: EventCmBrief;
};

export const EventCmComposition: React.FC<EventCmVideoProps> = ({ brief: raw }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  // The whole film, derived once (film.ts). This component only sequences it —
  // suppression, timing, scene building and captions are not its business.
  const film = eventCmFilm(raw);
  const brief = film.drawn;
  const theme = film.theme;

  // Music opens alone, steps back under the narration, and comes up again for
  // the close. Ducking costs nothing here — Remotion takes volume as a
  // function of the frame — so the film does not have to choose one level for
  // its whole length.
  //
  // With no voice yet there is nothing to duck under, and the music carries
  // the film at full level. The same composition therefore works at every
  // stage of the take's life, which is the point (timeline.ts).
  const hasVoice = film.hasVoice;
  const FULL = 0.62;
  const UNDER_VOICE = 0.16;
  const startFrame = msToFrame(film.narrationStartMs, fps);
  const endFrame = msToFrame(film.narrationEndMs, fps);
  const duckIn = Math.round(fps * 0.5);
  const duckOut = Math.round(fps * 0.8);

  const bgmVolume = hasVoice
    ? interpolate(
        frame,
        [
          0,
          20,
          startFrame,
          startFrame + duckIn,
          Math.max(startFrame + duckIn + 1, endFrame - duckOut),
          endFrame,
          durationInFrames,
        ],
        [0, FULL, FULL, UNDER_VOICE, UNDER_VOICE, FULL, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : interpolate(
        frame,
        [0, 20, durationInFrames - 40, durationInFrames],
        [0, FULL, FULL, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );

  return (
    <AbsoluteFill
      style={{ fontFamily: theme.textFont, backgroundColor: theme.palette.ground }}
    >
      <EventBackground />
      {brief.bgm && (
        <Audio src={resolveMediaSrc(brief.bgm)} volume={() => bgmVolume} loop />
      )}
      {brief.voice ? (
        // Held back by the lead-in so the opening belongs to the music.
        <Sequence from={msToFrame(film.narrationStartMs, fps)}>
          <Audio src={resolveMediaSrc(brief.voice.audio)} />
        </Sequence>
      ) : null}
      {film.scenes.map((scene) => {
        // One picture per scene. The film's shape is the film's shape here too:
        // keyed by scene identity rather than by role, because three programme
        // pictures share a role and React would have treated them as one
        // Sequence re-rendered three times.
        const from = msToFrame(scene.fromMs, fps);
        const length = msToFrames(scene.durationMs, fps);
        return (
          <Sequence key={scene.key} from={from} durationInFrames={length}>
            <Stage scene={scene.scene} theme={theme} length={length} />
          </Sequence>
        );
      })}
      {/* Above every scene. Subtitles are not one scene's business. */}
      <CaptionBand captions={film.captions} theme={theme} />
    </AbsoluteFill>
  );
};

/** Total frames for this brief — the Player and the renderer must agree. */
export const eventCmDurationInFrames = (brief: EventCmBrief, fps = EVENT_FPS): number =>
  msToFrames(eventCmFilm(brief).totalMs, fps);
