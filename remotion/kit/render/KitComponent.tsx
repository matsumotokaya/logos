// Drawing one component of the vocabulary.
//
// Every judgment the sake template made by hand — the gold rule that opens
// from the centre, the per-character title reveal, the monogram medallion
// standing in for a missing portrait, the vertical side copy — lives here now,
// as a property of the component rather than of one composition. That is the
// whole point of the rewrite: those decisions were good, and they were
// trapped.
//
// Nothing here reads a brief. A component is given its parameters, its
// emphasis and a theme, and draws. What goes in it is decided upstream.

import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import {
  emphasisOf,
  isEmpty,
  type Emphasis,
  type PersonParams,
  type SceneComponent,
} from "../components";
import type { LogoTreatment } from "@/remotion/event/types";
import type { Theme } from "../theme";
import { enterStyle } from "./motion";
import { focusPosition, TREATMENT_FILTER } from "../paint";

const resolveSrc = (src: string): string => src;

function typeStyle(theme: Theme, emphasis: Emphasis, display: boolean): React.CSSProperties {
  const step = theme.scale[emphasis];
  return {
    fontFamily: display ? theme.displayFont : theme.textFont,
    fontSize: step.size,
    lineHeight: step.lineHeight,
    letterSpacing: `${step.tracking}em`,
    color: theme.palette.ink,
  };
}

/** Per-character staggered reveal. Reserved for the loudest text on a stage:
 *  used everywhere it becomes a tic rather than an entrance. */
const CharReveal: React.FC<{
  text: string;
  delay: number;
  style: React.CSSProperties;
}> = ({ text, delay, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", ...style }}>
      {Array.from(text).map((char, i) => {
        const start = delay + i * 4;
        const t = interpolate(frame, [start, start + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const ease = 1 - Math.pow(1 - t, 3);
        return (
          <span
            key={`${char}-${i}`}
            style={{
              display: "inline-block",
              opacity: ease,
              transform: `translateY(${(1 - ease) * 30}px)`,
              filter: `blur(${(1 - ease) * 6}px)`,
            }}
          >
            {char === " " ? " " : char}
          </span>
        );
      })}
    </div>
  );
};

/** A hairline that opens from the centre. Structure in this art direction. */
const Rule: React.FC<{ theme: Theme; width: number; delay: number }> = ({
  theme,
  width,
  delay,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        width,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${theme.palette.accentBright}, transparent)`,
        transform: `scaleX(${1 - Math.pow(1 - t, 3)})`,
        opacity: t,
      }}
    />
  );
};

/**
 * A portrait, or the designed substitute for one.
 *
 * The monogram is not a placeholder: a gold-ringed medallion carrying the
 * family name is a finished way to present a speaker whose photo never
 * arrived, and it is why this template can ship with no assets at all.
 */
const Portrait: React.FC<{ theme: Theme; person: PersonParams; size: number }> = ({
  theme,
  person,
  size,
}) => {
  const initial = person.name.trim().charAt(0) || "・";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: `1px solid ${theme.palette.accent}`,
        boxShadow: `0 0 0 6px ${theme.palette.ground}, 0 0 40px rgba(0,0,0,0.5)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.palette.ground,
      }}
    >
      {person.photo ? (
        <Img
          src={resolveSrc(person.photo.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: focusPosition(person.photo),
            transform: `scale(${person.photo.zoom ?? 1})`,
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: theme.displayFont,
            fontSize: size * 0.42,
            color: theme.palette.accentBright,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
};

const PersonBlock: React.FC<{ theme: Theme; person: PersonParams; size: number }> = ({
  theme,
  person,
  size,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
    <Portrait theme={theme} person={person} size={size} />
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: theme.displayFont,
          fontSize: theme.scale.secondary.size,
          letterSpacing: "0.08em",
          color: theme.palette.ink,
        }}
      >
        {person.name}
      </div>
      {person.role ? (
        <div
          style={{
            marginTop: 8,
            fontFamily: theme.textFont,
            fontSize: theme.scale.caption.size,
            lineHeight: 1.6,
            letterSpacing: "0.12em",
            color: theme.palette.muted,
            whiteSpace: "pre-line",
          }}
        >
          {person.role}
        </div>
      ) : null}
    </div>
  </div>
);

/** A logo image, or its name set as a credit — the designed substitute.
 *  The treatment filter itself lives in ../paint.ts, shared with the
 *  storyboard. */
const LogoMark: React.FC<{
  theme: Theme;
  src: string | null;
  name: string;
  scale?: number;
  height: number;
  treatment?: LogoTreatment;
}> = ({ theme, src, name, scale = 1, height, treatment = "knockout" }) =>
  src ? (
    <Img
      src={resolveSrc(src)}
      style={{
        height: height * scale,
        width: "auto",
        objectFit: "contain",
        filter: TREATMENT_FILTER[treatment],
      }}
    />
  ) : (
    <span
      style={{
        fontFamily: theme.displayFont,
        fontSize: theme.scale.caption.size,
        letterSpacing: "0.2em",
        color: theme.palette.muted,
      }}
    >
      {name}
    </span>
  );

export const KitComponent: React.FC<{
  component: SceneComponent;
  theme: Theme;
  emphasis: Emphasis;
  /** Frame this component starts arriving on. */
  delay: number;
}> = ({ component, theme, emphasis, delay }) => {
  const frame = useCurrentFrame();
  const enter = enterStyle(theme, emphasis, frame, delay);
  const step = theme.scale[emphasis];

  // An empty component either draws its substitute (handled inside the pieces
  // above) or leaves. Text-only kinds leave.
  if (isEmpty(component) && component.kind !== "image") {
    const substitutes = ["person", "people", "logo", "logoRow"];
    if (!substitutes.includes(component.kind)) return null;
  }

  switch (component.kind) {
    case "kicker":
      return (
        <div
          style={{
            ...enter,
            ...typeStyle(theme, emphasis, false),
            letterSpacing: "0.34em",
            color: theme.palette.faint,
          }}
        >
          {component.text}
        </div>
      );

    case "heading":
      // The one place per stage that gets a character reveal.
      return emphasis === "hero" ? (
        <CharReveal
          text={component.text}
          delay={delay}
          style={{
            ...typeStyle(theme, emphasis, true),
            fontWeight: 600,
            justifyContent: "center",
            textShadow: `0 0 60px ${theme.palette.ground}, 0 0 120px ${theme.palette.ground}`,
          }}
        />
      ) : (
        <div style={{ ...enter, ...typeStyle(theme, emphasis, true), fontWeight: 600 }}>
          {component.text}
        </div>
      );

    case "subheading":
      return (
        <div
          style={{
            ...enter,
            ...typeStyle(theme, emphasis, true),
            color: theme.palette.accentBright,
          }}
        >
          {component.text}
        </div>
      );

    case "lines":
      return (
        <div style={{ ...enter, ...typeStyle(theme, emphasis, true) }}>
          {component.lines.map((line, i) => (
            <div key={`${line}-${i}`}>{line}</div>
          ))}
        </div>
      );

    case "body":
      return (
        <div
          style={{
            ...enter,
            ...typeStyle(theme, emphasis, false),
            color: theme.palette.muted,
            maxWidth: step.charsPerLine * step.size,
          }}
        >
          {component.text}
        </div>
      );

    case "chip":
      return (
        <div
          style={{
            ...enter,
            ...typeStyle(theme, emphasis, false),
            display: "inline-block",
            padding: "10px 26px",
            border: `1px solid ${theme.palette.accent}`,
            color: theme.palette.accentBright,
            letterSpacing: "0.2em",
          }}
        >
          {component.text}
        </div>
      );

    case "list":
      return (
        <div style={{ ...enter, display: "flex", flexDirection: "column", gap: 26 }}>
          {component.items.map((item, i) => (
            <div key={`${item}-${i}`} style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
              {component.numbered !== false ? (
                <span
                  style={{
                    fontFamily: theme.displayFont,
                    fontSize: step.size * 1.15,
                    color: theme.palette.accent,
                    minWidth: step.size * 1.6,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              ) : null}
              <span style={typeStyle(theme, emphasis, false)}>{item}</span>
            </div>
          ))}
        </div>
      );

    case "person":
      return (
        <div style={enter}>
          <PersonBlock theme={theme} person={component.person} size={step.size * 5} />
        </div>
      );

    case "people":
      return (
        <div style={{ ...enter, display: "flex", gap: 72, justifyContent: "center" }}>
          {component.people.map((person, i) => (
            <PersonBlock
              key={`${person.name}-${i}`}
              theme={theme}
              person={person}
              size={step.size * 4}
            />
          ))}
        </div>
      );

    case "logo":
      return (
        <div style={enter}>
          <LogoMark
            theme={theme}
            src={component.src}
            name={component.name}
            scale={component.scale}
            treatment={component.treatment}
            height={step.size * 1.6}
          />
        </div>
      );

    case "logoRow":
      return (
        <div
          style={{
            ...enter,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 56,
            flexWrap: "wrap",
          }}
        >
          {component.logos.map((logo, i) => (
            <LogoMark
              key={`${logo.name}-${i}`}
              theme={theme}
              src={logo.src}
              name={logo.name}
              scale={logo.scale}
              treatment={logo.treatment}
              height={step.size * 1.5}
            />
          ))}
        </div>
      );

    case "stat":
      return (
        <div style={{ ...enter, textAlign: "center" }}>
          <span style={{ ...typeStyle(theme, emphasis, true), color: theme.palette.accentBright }}>
            {component.value}
          </span>
          {component.unit ? (
            <span
              style={{
                fontFamily: theme.displayFont,
                fontSize: step.size * 0.5,
                color: theme.palette.accent,
                marginLeft: 8,
              }}
            >
              {component.unit}
            </span>
          ) : null}
          {component.label ? (
            <div
              style={{
                marginTop: 10,
                fontFamily: theme.textFont,
                fontSize: theme.scale.caption.size,
                letterSpacing: "0.18em",
                color: theme.palette.muted,
              }}
            >
              {component.label}
            </div>
          ) : null}
        </div>
      );

    case "datetime":
      // Three sizes, always: the numerals carry, the weekday rides small
      // beside them, the time sits under. Every well-set announcement does
      // this, which is why it is one component and not three.
      return (
        <div style={{ ...enter, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ ...typeStyle(theme, emphasis, true), letterSpacing: "0.04em" }}>
              {component.date}
            </span>
            {component.weekday ? (
              <span
                style={{
                  fontFamily: theme.displayFont,
                  fontSize: step.size * 0.45,
                  letterSpacing: "0.24em",
                  color: theme.palette.accent,
                }}
              >
                {component.weekday}
              </span>
            ) : null}
          </div>
          {component.time ? (
            <span
              style={{
                fontFamily: theme.textFont,
                fontSize: theme.scale.caption.size,
                letterSpacing: "0.28em",
                color: theme.palette.muted,
              }}
            >
              {component.time}
            </span>
          ) : null}
        </div>
      );

    case "cta":
      return (
        <div
          style={{
            ...enter,
            ...typeStyle(theme, emphasis, false),
            letterSpacing: "0.2em",
            color: theme.palette.accentBright,
          }}
        >
          {component.text}
        </div>
      );

    case "image": {
      // Empty is not a hole: the theme's ground shows through, which is the
      // designed state (components.ts EMPTY_BEHAVIOUR.image).
      if (!component.photo) return null;
      const scale = interpolate(frame, [0, 240], [1.06, 1.14]);
      return (
        <Img
          src={resolveSrc(component.photo.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: focusPosition(component.photo),
            opacity: enter.opacity,
            transform: `scale(${scale})`,
          }}
        />
      );
    }

    case "rule":
      return theme.ornament.rules ? (
        <Rule theme={theme} width={component.length === "full" ? 720 : 240} delay={delay} />
      ) : null;

    case "mark":
      return (
        <div
          style={{
            ...enter,
            fontFamily: theme.displayFont,
            fontSize: step.size,
            letterSpacing: "0.3em",
            color: theme.palette.accent,
          }}
        >
          {component.glyph ?? theme.ornament.markGlyph}
        </div>
      );
  }
};

/** Emphasis a component ends up at when nothing overrides it. */
export const defaultEmphasisOf = emphasisOf;
