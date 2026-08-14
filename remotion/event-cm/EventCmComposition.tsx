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
import { sceneForRole } from "@/remotion/kit/scenes/event-cm";
import { SUMI_THEME, themeForBrand, type Theme } from "@/remotion/kit/theme";
import { CaptionBand } from "@/remotion/kit/render/CaptionBand";
import { applySuppression } from "@/lib/event-cm/facts";
import { captionsFor } from "./captions";
import { eventCmTimeline, msToFrame, msToFrames } from "./timeline";
import { eventCmSceneKey } from "./types";
import type { EventCmBrief } from "./types";

export { EVENT_FPS, EVENT_WIDTH, EVENT_HEIGHT };

export type EventCmVideoProps = {
  brief: EventCmBrief;
};

/** The theme this brief renders under: the reference art direction, wearing
 *  whatever the brand actually has. */
export const themeOf = (brief: EventCmBrief): Theme =>
  brief.theme ? themeForBrand(SUMI_THEME, brief.theme) : SUMI_THEME;

export const EventCmComposition: React.FC<EventCmVideoProps> = ({ brief: raw }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  // A field the user switched off is emptied before anything is built, so the
  // components' existing empty behaviour carries the decision.
  const brief = applySuppression(raw);
  const timeline = eventCmTimeline(brief);
  const theme = themeOf(brief);

  // Music opens alone, steps back under the narration, and comes up again for
  // the close. Ducking costs nothing here — Remotion takes volume as a
  // function of the frame — so the film does not have to choose one level for
  // its whole length.
  //
  // With no voice yet there is nothing to duck under, and the music carries
  // the film at full level. The same composition therefore works at every
  // stage of the take's life, which is the point (timeline.ts).
  const hasVoice = Boolean(brief.voice);
  const FULL = 0.62;
  const UNDER_VOICE = 0.16;
  const startFrame = msToFrame(timeline.narrationStartMs, fps);
  const endFrame = msToFrame(timeline.narrationEndMs, fps);
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
        <Sequence from={msToFrame(timeline.narrationStartMs, fps)}>
          <Audio src={resolveMediaSrc(brief.voice.audio)} />
        </Sequence>
      ) : null}
      {timeline.scenes.map((beat) => {
        // One picture per scene. The film's shape is the timeline's shape.
        //
        // Keyed by scene identity rather than by role: three programme pictures
        // share a role, and React would have treated them as one Sequence
        // re-rendered three times.
        const from = msToFrame(beat.fromMs, fps);
        const length = msToFrames(beat.durationMs, fps);
        return (
          <Sequence
            key={eventCmSceneKey(beat)}
            from={from}
            durationInFrames={length}
          >
            <Stage
              scene={sceneForRole(beat.role, brief, beat.index)}
              theme={theme}
              length={length}
            />
          </Sequence>
        );
      })}
      {/* Above every scene. Subtitles are not one scene's business. */}
      <CaptionBand captions={captionsFor(brief)} theme={theme} />
    </AbsoluteFill>
  );
};

/** Total frames for this brief — the Player and the renderer must agree. */
export const eventCmDurationInFrames = (brief: EventCmBrief, fps = EVENT_FPS): number =>
  msToFrames(eventCmTimeline(brief).totalMs, fps);
