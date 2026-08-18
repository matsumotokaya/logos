// The seven pictures, hand-composed.
//
// Same words, same order, same lengths (eventCmFilm decides those). What is
// free here is everything visual: photography full-bleed, mincho type,
// vertical setting where it earns it, one designed visual event per few
// seconds so a 13-second beat is watched rather than endured.

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveSrc } from "@/remotion/kit/paint";
import type { EventCmBrief } from "@/remotion/event-cm/types";
import type { EventPhoto } from "@/remotion/event/types";
import { FH, KANJI_NUMERALS, LETTERBOX } from "./palette";
import { GoldDust } from "./chrome";
import { CameraMove, Photo, Scrim } from "./Photo";
import { CollageGround, SequenceGround, VideoGround } from "./Ground";
import { GROUNDS } from "./sources";
import marks from "./marks.json";

/* ---------------------------------------------------------------- helpers */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fade+rise entrance. Returns style for a block appearing at `delay`. */
const enter = (
  frame: number,
  delay: number,
  { dur = 16, rise = 26 }: { dur?: number; rise?: number } = {},
): React.CSSProperties => {
  const p = interpolate(frame, [delay, delay + dur], [0, 1], clamp);
  const eased = 1 - Math.pow(1 - p, 3);
  return { opacity: eased, transform: `translateY(${(1 - eased) * rise}px)` };
};

/** A gold hairline that draws itself. */
const GoldRule: React.FC<{
  width: number;
  delay: number;
  frame: number;
  vertical?: boolean;
}> = ({ width, delay, frame, vertical }) => {
  const p = interpolate(frame, [delay, delay + 20], [0, 1], clamp);
  const eased = 1 - Math.pow(1 - p, 3);
  return (
    <div
      style={{
        width: vertical ? 2 : width * eased,
        height: vertical ? width * eased : 2,
        background: `linear-gradient(to ${vertical ? "bottom" : "right"}, ${FH.gold}, ${FH.goldDim})`,
        opacity: p > 0 ? 1 : 0,
      }}
    />
  );
};

/** Small tracking-wide gold label (kickers, micro-labels). */
const Kicker: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div
    style={{
      fontFamily: FH.font,
      fontWeight: 600,
      fontSize: 26,
      letterSpacing: "0.42em",
      color: FH.gold,
      ...style,
    }}
  >
    {text}
  </div>
);

const SAFE_TOP = LETTERBOX;
const SAFE_HEIGHT = 1080 - LETTERBOX * 2;

/** The visible band between the letterbox bars. */
const Band: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      position: "absolute",
      top: SAFE_TOP,
      height: SAFE_HEIGHT,
      left: 0,
      right: 0,
      ...style,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------- mark scene */

export const FhMarkScene: React.FC<{
  brief: EventCmBrief;
  length: number;
  opening: boolean;
}> = ({ brief, length, opening }) => {
  const frame = useCurrentFrame();
  const mark = brief.logos[0] ?? null;
  const breathe = 0.5 + Math.sin(frame * 0.04) * 0.12;
  const fadeOut = opening
    ? 1
    : interpolate(frame, [length - 22, length - 2], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: FH.ink, opacity: fadeOut }}>
      {/* The close stands on Fuji above the clouds, darkened until the mark
          owns the frame; the opening on the client's black plaster wall with
          real gold dust in it (sources.ts). The film still ends wider than it
          began — a wall, then a sky. */}
      {!opening && GROUNDS.logoOut.src ? (
        <>
          <VideoGround
            src={GROUNDS.logoOut.src}
            grade="saturate(0.85) brightness(0.85)"
          />
          <AbsoluteFill style={{ background: "rgba(8,6,4,0.58)" }} />
          <Scrim side="radial" strength={0.5} />
        </>
      ) : null}
      {opening ? (
        <>
          {groundFor("logoIn", length)}
          <AbsoluteFill style={{ background: "rgba(8,6,4,0.35)" }} />
        </>
      ) : null}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 48% at 50% 46%, rgba(201,162,39,${0.13 * breathe}), transparent 70%)`,
        }}
      />
      <GoldDust opacity={0.8} />
      <Band
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
        }}
      >
        {opening && brief.seriesLabel ? (
          <div style={enter(frame, 4)}>
            <Kicker text={brief.seriesLabel} />
          </div>
        ) : null}
        <div style={enter(frame, opening ? 12 : 4, { rise: 18 })}>
          {mark?.src ? (
            <Img
              src={resolveSrc(mark.src)}
              style={{
                height: 130,
                filter: "brightness(0) invert(1) drop-shadow(0 0 24px rgba(244,239,228,0.18))",
                opacity: 0.96,
              }}
            />
          ) : (
            <div
              style={{
                fontFamily: FH.font,
                fontWeight: 700,
                fontSize: 84,
                color: FH.paper,
                letterSpacing: "0.12em",
              }}
            >
              {mark?.name ?? brief.presenter}
            </div>
          )}
        </div>
        <GoldRule width={210} delay={opening ? 26 : 14} frame={frame} />
        {opening && brief.presenter ? (
          <div
            style={{
              ...enter(frame, 34, { rise: 14 }),
              fontFamily: FH.font,
              fontWeight: 500,
              fontSize: 27,
              letterSpacing: "0.3em",
              color: FH.paperMuted,
            }}
          >
            {brief.presenter}
          </div>
        ) : null}
      </Band>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ title scene */

export const FhTitleScene: React.FC<{ brief: EventCmBrief; length: number }> = ({
  brief,
  length,
}) => {
  const frame = useCurrentFrame();
  const chars = Array.from(brief.title);
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {/* The pour, then the stillness after it (sources.ts). */}
      {groundFor("title", length)}
      <Scrim side="left" strength={0.55} reach={64} />
      <Scrim side="bottom" strength={0.5} reach={44} />
      {/* The title, set vertically — the one scene that earns the full 和 move. */}
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 48,
          right: 150,
          height: SAFE_HEIGHT - 96,
          display: "flex",
          justifyContent: "center",
          writingMode: "vertical-rl",
          fontFamily: FH.font,
          fontWeight: 700,
          fontSize: 76,
          letterSpacing: "0.16em",
          color: FH.paper,
          textShadow: "0 2px 28px rgba(5,3,2,0.75)",
        }}
      >
        {chars.map((ch, i) => {
          const p = interpolate(frame, [12 + i * 3, 12 + i * 3 + 16], [0, 1], clamp);
          const eased = 1 - Math.pow(1 - p, 3);
          return (
            <span key={i} style={{ opacity: eased, transform: `translateX(${(1 - eased) * -20}px)` }}>
              {ch}
            </span>
          );
        })}
      </div>
      {/* The promise line, quietly, lower left. */}
      <div
        style={{
          position: "absolute",
          left: 130,
          bottom: LETTERBOX + 78,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <GoldRule width={230} delay={48} frame={frame} />
        {brief.subtitle ? (
          <div
            style={{
              ...enter(frame, 56, { rise: 16 }),
              fontFamily: FH.font,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: "0.28em",
              color: FH.goldBright,
              textShadow: "0 1px 14px rgba(5,3,2,0.8)",
            }}
          >
            {brief.subtitle}
          </div>
        ) : null}
      </div>
      {brief.seriesLabel ? (
        <div style={{ position: "absolute", left: 130, top: SAFE_TOP + 56, ...enter(frame, 8) }}>
          <Kicker text={brief.seriesLabel} style={{ fontSize: 22, color: FH.paperFaint }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------ value scene */

export const FhValueScene: React.FC<{ brief: EventCmBrief; length: number }> = ({
  brief,
  length,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {/* The drop, then the same table at rest (sources.ts). */}
      {groundFor("value", length)}
      <Scrim side="left" strength={0.72} reach={70} />
      <div
        style={{
          position: "absolute",
          left: 130,
          top: SAFE_TOP,
          height: SAFE_HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 44,
          maxWidth: 1050,
        }}
      >
        {brief.valueChip ? (
          <div style={enter(frame, 6)}>
            <span
              style={{
                fontFamily: FH.font,
                fontWeight: 600,
                fontSize: 25,
                letterSpacing: "0.34em",
                color: FH.goldBright,
                border: `1px solid ${FH.goldDim}`,
                padding: "12px 26px 12px 34px",
              }}
            >
              {brief.valueChip}
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 38 }}>
          {brief.valueLines.map((line, i) => {
            const delay = 20 + i * Math.max(24, Math.floor((length - 80) / Math.max(1, brief.valueLines.length)));
            return (
              <div
                key={i}
                style={{
                  ...enter(frame, delay, { rise: 30, dur: 20 }),
                  display: "flex",
                  alignItems: "baseline",
                  gap: 26,
                }}
              >
                <span
                  style={{
                    fontFamily: FH.font,
                    color: FH.gold,
                    fontSize: 30,
                    fontWeight: 600,
                    transform: "translateY(-6px)",
                  }}
                >
                  —
                </span>
                <span
                  style={{
                    fontFamily: FH.font,
                    fontWeight: 600,
                    fontSize: 48,
                    lineHeight: 1.55,
                    letterSpacing: "0.06em",
                    color: FH.paper,
                    textShadow: "0 2px 22px rgba(5,3,2,0.7)",
                    textWrap: "balance",
                  }}
                >
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------- program scene */

// Grounds live in sources.ts; what the scene keeps is the text side,
// alternating L→R→L so the trio reads as a sequence.
const PROGRAM_SIDES: Array<"left" | "right"> = ["left", "right", "left"];

/** Any scene's ground, whatever shape sources.ts gave it. */
const groundFor = (key: string, length: number): React.ReactNode => {
  const ground = GROUNDS[key];
  if (!ground) return <GoldDust />;
  switch (ground.kind) {
    case "sequence":
      return <SequenceGround shots={ground.shots!} length={length} />;
    case "video":
      return <VideoGround src={ground.src!} />;
    case "collage":
      return <CollageGround srcs={ground.srcs!} length={length} />;
    case "image":
      return (
        <Photo
          src={ground.src!}
          length={length}
          move={ground.move ?? { scaleFrom: 1.04, scaleTo: 1.12 }}
          focus={ground.focus ?? { x: 0.5, y: 0.5 }}
          grade={ground.grade}
        />
      );
  }
};

export const FhProgramScene: React.FC<{
  brief: EventCmBrief;
  length: number;
  index: number;
  total: number;
}> = ({ brief, length, index, total }) => {
  const frame = useCurrentFrame();
  const side = PROGRAM_SIDES[index % PROGRAM_SIDES.length];
  const numeral = KANJI_NUMERALS[index % KANJI_NUMERALS.length];
  const item = brief.programs[index] ?? null;
  const left = side === "left";

  const numeralIn = interpolate(frame, [4, 26], [0, 1], clamp);
  const numeralEased = 1 - Math.pow(1 - numeralIn, 3);

  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {groundFor(`program${index}`, length)}
      <Scrim side={side} strength={0.74} reach={78} />
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          height: SAFE_HEIGHT,
          ...(left ? { left: 130 } : { right: 130 }),
          width: 1000,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: left ? "flex-start" : "flex-end",
          gap: 8,
        }}
      >
        {brief.programsHeading ? (
          <div style={enter(frame, 6)}>
            <Kicker
              text={brief.programsHeading}
              style={{ fontSize: 23, color: FH.paperFaint }}
            />
          </div>
        ) : null}
        {/* The numeral as a seal: a hairline gold square holding the plain
            kanji. 一二三 set bare at display size read as bars (一 IS a bar);
            the box carries the visual mass and the number stays the subject.
            Replaced the 250px bare-glyph pattern — a second pattern to
            compare, per the client's ask. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 28,
            flexDirection: left ? "row" : "row-reverse",
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: 190,
              height: 190,
              border: `1px solid ${FH.goldDim}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: numeralEased,
              transform: `translateY(${(1 - numeralEased) * 30}px)`,
              background: "rgba(8,6,4,0.35)",
            }}
          >
            <span
              style={{
                fontFamily: FH.font,
                fontWeight: 700,
                fontSize: 108,
                lineHeight: 1,
                color: FH.goldBright,
                textShadow: "0 2px 24px rgba(5,3,2,0.55)",
              }}
            >
              {numeral}
            </span>
          </div>
          <span
            style={{
              fontFamily: FH.font,
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: "0.5em",
              color: FH.goldDim,
              opacity: numeralEased,
              paddingBottom: 8,
            }}
          >
            {`PROGRAM ${index + 1} / ${total}`}
          </span>
        </div>
        <GoldRule width={520} delay={20} frame={frame} />
        {item ? (
          <div
            style={{
              ...enter(frame, 30, { rise: 30, dur: 20 }),
              fontFamily: FH.font,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.85,
              letterSpacing: "0.05em",
              color: FH.paper,
              textAlign: left ? "left" : "right",
              textShadow: "0 2px 22px rgba(5,3,2,0.75)",
              marginTop: 34,
              textWrap: "balance",
            }}
          >
            {item.title}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------- guests scene */

export const FhGuestsScene: React.FC<{ brief: EventCmBrief; length: number }> = ({
  brief,
  length,
}) => {
  const frame = useCurrentFrame();
  const guests = brief.guests;
  const panelW = 1920 / Math.max(1, guests.length);
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {guests.map((guest, i) => {
        const slideIn = interpolate(frame, [4 + i * 8, 30 + i * 8], [0, 1], clamp);
        const eased = 1 - Math.pow(1 - slideIn, 3);
        const dir = i === 0 ? -1 : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * panelW,
              width: panelW,
              top: 0,
              height: 1080,
              overflow: "hidden",
              opacity: eased,
              transform: `translateX(${(1 - eased) * dir * 60}px)`,
            }}
          >
            {guest.photo ? (
              <>
                <Photo
                  src={guest.photo.src}
                  length={length}
                  move={{
                    scaleFrom: 1.08,
                    scaleTo: 1.16,
                    xFrom: dir * 0.8,
                    xTo: dir * -0.8,
                  }}
                  focus={guest.photo.focus ?? { x: 0.5, y: 0.4 }}
                  grade="saturate(0.96)"
                />
                <Scrim side="bottom" strength={0.78} reach={52} />
              </>
            ) : (
              <AbsoluteFill
                style={{
                  background: FH.inkSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    border: `2px solid ${FH.goldDim}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FH.font,
                    fontSize: 96,
                    fontWeight: 700,
                    color: FH.goldBright,
                  }}
                >
                  {Array.from(guest.name)[0] ?? "客"}
                </div>
              </AbsoluteFill>
            )}
            <div
              style={{
                position: "absolute",
                left: 90,
                bottom: LETTERBOX + 64,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                ...enter(frame, 26 + i * 8, { rise: 22 }),
              }}
            >
              <div
                style={{
                  fontFamily: FH.font,
                  fontWeight: 700,
                  fontSize: 64,
                  letterSpacing: "0.1em",
                  color: FH.paper,
                  textShadow: "0 2px 20px rgba(5,3,2,0.8)",
                }}
              >
                {guest.name}
              </div>
              <div
                style={{
                  fontFamily: FH.font,
                  fontWeight: 500,
                  fontSize: 27,
                  letterSpacing: "0.12em",
                  color: FH.paperMuted,
                }}
              >
                {guest.role}
              </div>
            </div>
          </div>
        );
      })}
      {/* Gold seam between the panels. */}
      {guests.length > 1 ? (
        <div
          style={{
            position: "absolute",
            left: panelW - 1,
            width: 2,
            top: LETTERBOX,
            height: SAFE_HEIGHT,
            background: `linear-gradient(to bottom, transparent, ${FH.goldDim} 30%, ${FH.goldDim} 70%, transparent)`,
            opacity: interpolate(frame, [20, 40], [0, 1], clamp),
          }}
        />
      ) : null}
      {brief.guestsHeading && guests.length > 1 ? (
        // On the seam, vertically, on its own ink tag — anywhere else it lands
        // on somebody's face.
        <div
          style={{
            position: "absolute",
            left: panelW - 37,
            top: SAFE_TOP + 54,
            width: 74,
            padding: "30px 0",
            background: "rgba(8,6,4,0.85)",
            border: `1px solid ${FH.goldDim}`,
            display: "flex",
            justifyContent: "center",
            writingMode: "vertical-rl",
            fontFamily: FH.font,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: "0.42em",
            color: FH.goldBright,
            ...enter(frame, 18, { rise: 0 }),
          }}
        >
          {brief.guestsHeading}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- cta scene */

// The credits row, from the normalised marks (scripts/normalize-marks.mjs):
// trimmed to the artwork's alpha box, sized by ink weight rather than by file
// height — a two-line lockup at a wordmark's height reads as the junior
// partner. Replaces the brief's logo list, which still carries the white-plate
// JPEG. Miss SAKE joins the row: the association is on stage twice (2026 Miss
// SAKE 2名 and the 代表理事), and its mark arrived 2026-08-18.
const MARK_ROW = (
  ["wealthpark-lab", "leopalace21", "shimeharitsuru", "miss-sake"] as const
).map((name) => ({
  name,
  ...(marks as Record<string, { src: string; ink: string; scale: number }>)[name],
}));

export const FhCtaScene: React.FC<{ brief: EventCmBrief; length: number }> = ({
  brief,
  length,
}) => {
  const frame = useCurrentFrame();
  const { schedule } = brief;
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {/* A person actually tasting — the invitation, embodied (sources.ts). */}
      {groundFor("cta", length)}
      <Scrim side="left" strength={0.8} reach={72} />
      <div
        style={{
          position: "absolute",
          left: 130,
          top: SAFE_TOP,
          height: SAFE_HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 26,
          maxWidth: 1050,
        }}
      >
        {schedule.date ? (
          <div style={{ ...enter(frame, 8, { rise: 26 }), display: "flex", alignItems: "baseline", gap: 26 }}>
            <span
              style={{
                fontFamily: FH.font,
                fontWeight: 700,
                fontSize: 88,
                letterSpacing: "0.04em",
                color: FH.paper,
                textShadow: "0 2px 26px rgba(5,3,2,0.8)",
              }}
            >
              {schedule.date}
            </span>
            {schedule.weekday ? (
              <span
                style={{
                  fontFamily: FH.font,
                  fontWeight: 600,
                  fontSize: 34,
                  color: FH.goldBright,
                  border: `1px solid ${FH.goldDim}`,
                  padding: "6px 16px",
                }}
              >
                {schedule.weekday}
              </span>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {schedule.time ? (
            <div
              style={{
                ...enter(frame, 20),
                fontFamily: FH.font,
                fontWeight: 500,
                fontSize: 32,
                letterSpacing: "0.14em",
                color: FH.paperMuted,
              }}
            >
              {schedule.time}
            </div>
          ) : null}
          {schedule.venue ? (
            <div
              style={{
                ...enter(frame, 26),
                fontFamily: FH.font,
                fontWeight: 500,
                fontSize: 32,
                letterSpacing: "0.14em",
                color: FH.paperMuted,
              }}
            >
              {schedule.venue}
            </div>
          ) : null}
          {schedule.fee ? (
            <div
              style={{
                ...enter(frame, 30),
                fontFamily: FH.font,
                fontWeight: 500,
                fontSize: 28,
                letterSpacing: "0.14em",
                color: FH.paperFaint,
              }}
            >
              {schedule.fee}
            </div>
          ) : null}
        </div>
        <GoldRule width={300} delay={34} frame={frame} />
        {brief.cta ? (
          <div
            style={{
              ...enter(frame, 42, { rise: 20 }),
              fontFamily: FH.font,
              fontWeight: 600,
              fontSize: 38,
              letterSpacing: "0.22em",
              color: FH.goldBright,
              textShadow: "0 1px 16px rgba(5,3,2,0.8)",
            }}
          >
            {brief.cta}
          </div>
        ) : null}
        <div
          style={{
            ...enter(frame, 52),
            display: "flex",
            alignItems: "center",
            gap: 48,
            marginTop: 22,
          }}
        >
          {MARK_ROW.map((mark) => (
            <Img
              key={mark.name}
              src={resolveSrc(mark.src)}
              style={{
                height: Math.round(40 * mark.scale),
                // The white-artwork marks sit on the ink as supplied; the dark
                // vector is knocked out. Same decision place-images.ts makes
                // from measured luminance.
                ...(mark.ink === "dark"
                  ? { filter: "brightness(0) invert(1)", opacity: 0.88 }
                  : { opacity: 0.92 }),
              }}
            />
          ))}
        </div>
        {brief.footnote ? (
          <div
            style={{
              ...enter(frame, 58),
              fontFamily: FH.font,
              fontSize: 22,
              color: FH.paperFaint,
              letterSpacing: "0.1em",
            }}
          >
            {brief.footnote}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
