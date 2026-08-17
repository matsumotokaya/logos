// The freehand cut.
//
// Everything the film SAYS comes from eventCmFilm(), untouched: scene order,
// scene lengths, narration timing, captions, audio. Everything the film SHOWS
// is replaced — this file and ./scenes.tsx are the experiment.

import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { resolveMediaSrc } from "@/remotion/event/EventComposition";
import { eventCmFilm } from "@/remotion/event-cm/film";
import { msToFrame, msToFrames } from "@/remotion/event-cm/timeline";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import type { FilmScene } from "@/remotion/event-cm/film";
import { FH } from "./palette";
import { FreehandCaptions, Grain, Letterbox, Vignette } from "./chrome";
import {
  FhCtaScene,
  FhGuestsScene,
  FhMarkScene,
  FhProgramScene,
  FhTitleScene,
  FhValueScene,
} from "./scenes";

export type FreehandProps = { brief: EventCmBrief };

const sceneView = (
  scene: FilmScene,
  brief: EventCmBrief,
  length: number,
  programTotal: number,
): React.ReactNode => {
  switch (scene.role) {
    case "logoIn":
      return <FhMarkScene brief={brief} length={length} opening />;
    case "title":
      return <FhTitleScene brief={brief} length={length} />;
    case "value":
      return <FhValueScene brief={brief} length={length} />;
    case "program":
      return (
        <FhProgramScene
          brief={brief}
          length={length}
          index={scene.index ?? 0}
          total={programTotal}
        />
      );
    case "guests":
      return <FhGuestsScene brief={brief} length={length} />;
    case "cta":
      return <FhCtaScene brief={brief} length={length} />;
    case "logoOut":
      return <FhMarkScene brief={brief} length={length} opening={false} />;
  }
};

export const FreehandComposition: React.FC<FreehandProps> = ({ brief: raw }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const film = useMemo(() => eventCmFilm(raw), [raw]);
  const brief = film.drawn;

  // Audio behaviour is the baseline's, verbatim: music opens alone, ducks
  // under the voice, returns for the close.
  const FULL = 0.62;
  const UNDER_VOICE = 0.16;
  const startFrame = msToFrame(film.voiceStartMs, fps);
  const endFrame = msToFrame(film.voiceEndMs, fps);
  const duckIn = Math.round(fps * 0.5);
  const duckOut = Math.round(fps * 0.8);
  const bgmVolume = film.hasVoice
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
    : interpolate(frame, [0, 20, durationInFrames - 40, durationInFrames], [0, FULL, FULL, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const programTotal = film.scenes.filter((scene) => scene.role === "program").length;

  return (
    <AbsoluteFill style={{ fontFamily: FH.font, backgroundColor: FH.ink }}>
      {brief.bgm && <Audio src={resolveMediaSrc(brief.bgm)} volume={() => bgmVolume} loop />}
      {brief.voice ? (
        <Sequence from={msToFrame(film.voiceStartMs, fps)}>
          <Audio src={resolveMediaSrc(brief.voice.audio)} />
        </Sequence>
      ) : null}
      {film.scenes.map((scene) => {
        const from = msToFrame(scene.fromMs, fps);
        const length = msToFrames(scene.durationMs, fps);
        return (
          <Sequence key={scene.key} from={from} durationInFrames={length}>
            {sceneView(scene, brief, length, programTotal)}
          </Sequence>
        );
      })}
      <Vignette />
      <Grain />
      <Letterbox />
      <FreehandCaptions captions={film.captions} />
    </AbsoluteFill>
  );
};
