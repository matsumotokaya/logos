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
  // The pour: the film's most dynamic photograph opens its most important line.
  const photo = brief.visuals.programs;
  const chars = Array.from(brief.title);
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {photo ? (
        <Photo
          src={photo.src}
          length={length}
          move={{ scaleFrom: 1.16, scaleTo: 1.04, xFrom: -1.5, xTo: 1 }}
          focus={{ x: 0.55, y: 0.42 }}
          grade="saturate(0.94) brightness(0.92)"
        />
      ) : (
        <GoldDust />
      )}
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
  const photo = brief.visuals.value;
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {photo ? (
        <Photo
          src={photo.src}
          length={length}
          move={{ scaleFrom: 1.06, scaleTo: 1.16, xFrom: 2, xTo: -2 }}
          focus={photo.focus ?? { x: 0.5, y: 0.5 }}
          grade="saturate(1.02)"
        />
      ) : (
        <GoldDust />
      )}
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

const PROGRAM_SHOTS: Array<{
  visual: (brief: EventCmBrief) => EventPhoto | null;
  focus: { x: number; y: number };
  move: CameraMove;
  grade?: string;
  /** Which side the text column sits on. */
  side: "left" | "right";
}> = [
  {
    // 壱 tasting — the pour, tight on the glass.
    visual: (b) => b.visuals.programs,
    focus: { x: 0.42, y: 0.62 },
    move: { scaleFrom: 1.22, scaleTo: 1.1, yFrom: 1, yTo: -1 },
    side: "left",
  },
  {
    // 弐 talk — the indigo textile behind the masu, as texture. (The noren
    // calligraphy was tried first, but the guest photo cannot crop the guest
    // out — his face entered every frame half-cut.)
    visual: (b) => b.visuals.value,
    focus: { x: 0.95, y: 0.08 },
    move: { scaleFrom: 1.55, scaleTo: 1.68, xFrom: 1, xTo: -1 },
    grade: "brightness(0.6) saturate(1.05)",
    side: "right",
  },
  {
    // 参 workshop — the pour again, but the tray and masu at the glass's foot:
    // a second reading of the same photograph, not a repeat of 壱's frame.
    visual: (b) => b.visuals.programs,
    focus: { x: 0.3, y: 0.9 },
    move: { scaleFrom: 1.42, scaleTo: 1.28, yFrom: -1, yTo: 1 },
    grade: "brightness(0.82)",
    side: "left",
  },
];

export const FhProgramScene: React.FC<{
  brief: EventCmBrief;
  length: number;
  index: number;
  total: number;
}> = ({ brief, length, index, total }) => {
  const frame = useCurrentFrame();
  const shot = PROGRAM_SHOTS[index % PROGRAM_SHOTS.length];
  const photo = shot.visual(brief);
  const numeral = KANJI_NUMERALS[index % KANJI_NUMERALS.length];
  const item = brief.programs[index] ?? null;
  const left = shot.side === "left";

  const numeralIn = interpolate(frame, [4, 26], [0, 1], clamp);
  const numeralEased = 1 - Math.pow(1 - numeralIn, 3);

  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {photo ? (
        <Photo
          src={photo.src}
          length={length}
          move={shot.move}
          focus={shot.focus}
          grade={shot.grade}
        />
      ) : (
        <GoldDust />
      )}
      <Scrim side={shot.side} strength={0.74} reach={78} />
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
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 30,
            flexDirection: left ? "row" : "row-reverse",
          }}
        >
          <span
            style={{
              fontFamily: FH.font,
              fontWeight: 800,
              fontSize: 250,
              lineHeight: 1.05,
              color: FH.gold,
              opacity: numeralEased * 0.96,
              transform: `translateY(${(1 - numeralEased) * 40}px)`,
              textShadow: "0 4px 40px rgba(5,3,2,0.6)",
            }}
          >
            {numeral}
          </span>
          <span
            style={{
              fontFamily: FH.font,
              fontWeight: 600,
              fontSize: 22,
              letterSpacing: "0.5em",
              color: FH.goldDim,
              opacity: numeralEased,
              transform: "translateY(-34px)",
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

export const FhCtaScene: React.FC<{ brief: EventCmBrief; length: number }> = ({
  brief,
  length,
}) => {
  const frame = useCurrentFrame();
  const photo = brief.visuals.closing;
  const { schedule } = brief;
  return (
    <AbsoluteFill style={{ background: FH.ink }}>
      {photo ? (
        <Photo
          src={photo.src}
          length={length}
          move={{ scaleFrom: 1.04, scaleTo: 1.14, xFrom: 1.2, xTo: -0.6 }}
          focus={photo.focus ?? { x: 0.5, y: 0.4 }}
          grade="saturate(0.9) brightness(0.9)"
        />
      ) : (
        <GoldDust />
      )}
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
        {brief.logos.length > 0 ? (
          <div
            style={{
              ...enter(frame, 52),
              display: "flex",
              alignItems: "center",
              gap: 44,
              marginTop: 22,
            }}
          >
            {brief.logos.map((logo, i) =>
              logo.src ? (
                <Img
                  key={i}
                  src={resolveSrc(logo.src)}
                  style={{
                    height: logo.src.endsWith(".svg") ? 44 : 52,
                    ...(logo.treatment === "light"
                      ? { borderRadius: 4, opacity: 0.94 }
                      : { filter: "brightness(0) invert(1)", opacity: 0.88 }),
                  }}
                />
              ) : (
                <span
                  key={i}
                  style={{
                    fontFamily: FH.font,
                    fontSize: 26,
                    color: FH.paperMuted,
                    letterSpacing: "0.14em",
                  }}
                >
                  {logo.name}
                </span>
              ),
            )}
          </div>
        ) : null}
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
