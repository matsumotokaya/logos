// The 30s CM video — problem-solution template (課題解決型), the first of the
// two fixed templates. Everything is driven by the Service Brand Kit and the
// voice track: scene boundaries come from the TTS mix (one cm_script scene =
// one sequence), on-screen text reuses the kit's LP copy, colors and logo are
// the brand's own. Consumed two ways with identical output:
//   - <Player> in /campaigns/[id]  (browser preview, no MP4 needed)
//   - `npm run campaign:render`    (local MP4 via the Remotion CLI)
//
// Motion vocabulary (persistent animated background, staggered card reveals
// with active-card focus, an audio-reactive equalizer, per-scene caption
// chips) is adapted from the xtrust concept video. No narrator avatar — a
// generated campaign has no per-brand presenter photo.
//
// Remotion rules: animate only via useCurrentFrame/interpolate/spring —
// CSS transitions/animations do not render correctly.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import type { CampaignBrandKit } from "../../lib/campaign/schema";
import type { CmVoiceScene, CmVoiceTrack } from "../../lib/campaign/cm-types";
import {
  CM_FPS,
  CM_WIDTH,
  CM_HEIGHT,
  CM_TAIL_MS,
  buildPalette,
  fontStack,
  type CmPalette,
} from "./palette";
import { CmBackground } from "./CmBackground";
import { Equalizer } from "./Equalizer";
import { springEnter, pop, wipeIn } from "./anim";

export { CM_FPS, CM_WIDTH, CM_HEIGHT, CM_TAIL_MS };

export interface CmVideoProps {
  kit: CampaignBrandKit;
  track: CmVoiceTrack;
  /** URL ("/..." or "http...") or a staticFile() name for the narration. */
  audioSrc: string | null;
  /** Optional default BGM (same resolution rules as audioSrc). */
  bgmSrc?: string | null;
}

export const cmDurationInFrames = (track: CmVoiceTrack): number =>
  Math.max(1, Math.ceil(((track.totalMs + CM_TAIL_MS) / 1000) * CM_FPS));

const msToFrame = (ms: number): number => Math.round((ms / 1000) * CM_FPS);

const resolveMediaSrc = (src: string): string =>
  /^(https?:)?\//.test(src) ? src : staticFile(src);

// ---------- shared pieces ----------

const hasLogoAsset = (kit: CampaignBrandKit): boolean =>
  Boolean(kit.assets?.logo_svg || kit.assets?.logo);

const Logo: React.FC<{ kit: CampaignBrandKit; height: number; pal: CmPalette }> = ({
  kit,
  height,
  pal,
}) => {
  const svg = kit.assets?.logo_svg ?? null;
  const png = kit.assets?.logo ?? null;
  const src = useMemo(() => {
    if (svg) return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    if (png) return `data:${png.media_type};base64,${png.data}`;
    return null;
  }, [svg, png]);

  if (!src) {
    return (
      <div
        style={{
          fontSize: height * 0.72,
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: pal.text,
          lineHeight: 1,
        }}
      >
        {kit.service.name}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        borderRadius: height * 0.22,
        padding: `${height * 0.18}px ${height * 0.3}px`,
        boxShadow: pal.dark ? "0 20px 60px rgba(0,0,0,0.45)" : "0 12px 40px rgba(0,0,0,0.12)",
      }}
    >
      <Img src={src} style={{ height, width: "auto", maxWidth: height * 6, objectFit: "contain" }} />
    </div>
  );
};

/** Per-scene entrance: fade + rise, driven by the scene-local frame. */
const useEnter = (delayFrames = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springEnter(frame, fps, delayFrames);
  return { opacity: s.opacity, transform: `translateY(${s.translateY}px)` };
};

const SceneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      padding: "150px 160px 240px",
      textAlign: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Small scene-label chip, top-left — the "what are we looking at" cue. */
const CaptionChip: React.FC<{ label: string; pal: CmPalette }> = ({ label, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springEnter(frame, fps, 2);
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 72,
        opacity: s.opacity,
        transform: `translateX(${interpolate(s.translateY, [0, 42], [0, -30])}px)`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          background: pal.dark ? "rgba(255,255,255,0.94)" : "#ffffff",
          color: "#0e0d14",
          padding: "16px 28px",
          borderRadius: 12,
          fontSize: 30,
          fontWeight: 700,
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <span style={{ width: 6, height: 30, borderRadius: 3, background: pal.primary }} />
        {label}
      </div>
    </div>
  );
};

// ---------- scenes ----------

const HookScene: React.FC<{ kit: CampaignBrandKit; pal: CmPalette }> = ({ kit, pal }) => {
  const logoIn = useEnter(0);
  const nameIn = useEnter(10);
  const showLogo = hasLogoAsset(kit);
  return (
    <SceneShell>
      {showLogo && (
        <div style={logoIn}>
          <Logo kit={kit} height={110} pal={pal} />
        </div>
      )}
      <div style={{ ...nameIn, marginTop: showLogo ? 56 : 0 }}>
        <div style={{ fontSize: 84, fontWeight: 700, color: pal.text, lineHeight: 1.15 }}>
          {kit.service.name}
        </div>
        <div style={{ fontSize: 40, color: pal.muted, marginTop: 20 }}>
          {kit.service.tagline}
        </div>
      </div>
    </SceneShell>
  );
};

const ProblemScene: React.FC<{
  kit: CampaignBrandKit;
  pal: CmPalette;
  lengthInFrames: number;
}> = ({ kit, pal, lengthInFrames }) => {
  const headIn = useEnter(0);
  const points = kit.copy.problem.points.slice(0, 3);
  const stagger = Math.max(10, Math.floor((lengthInFrames * 0.6) / Math.max(1, points.length)));
  return (
    <SceneShell>
      <div style={{ ...headIn, fontSize: 60, fontWeight: 700, color: pal.text, maxWidth: 1400 }}>
        {kit.copy.problem.headline}
      </div>
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 24 }}>
        {points.map((p, i) => (
          <ProblemPoint key={p} text={p} delay={14 + i * stagger} pal={pal} />
        ))}
      </div>
    </SceneShell>
  );
};

const ProblemPoint: React.FC<{ text: string; delay: number; pal: CmPalette }> = ({
  text,
  delay,
  pal,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springEnter(frame, fps, delay);
  return (
    <div
      style={{
        opacity: s.opacity,
        transform: `translateX(${interpolate(s.translateY, [0, 42], [0, 70])}px) translateY(${s.translateY}px)`,
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: pal.dark ? "rgba(255,255,255,0.94)" : "#ffffff",
        borderRadius: 20,
        padding: "26px 42px",
        fontSize: 40,
        color: "#14131a",
        textAlign: "left",
        boxShadow: pal.dark ? "0 16px 40px rgba(0,0,0,0.3)" : "0 12px 34px rgba(0,0,0,0.1)",
      }}
    >
      <span style={{ color: "#f5a623", fontWeight: 700, fontSize: 42 }}>⚠</span>
      {text}
    </div>
  );
};

const SolutionScene: React.FC<{ kit: CampaignBrandKit; pal: CmPalette }> = ({ kit, pal }) => {
  const logoIn = useEnter(0);
  const headIn = useEnter(8);
  return (
    <SceneShell>
      <div style={logoIn}>
        <Logo kit={kit} height={72} pal={pal} />
      </div>
      <div
        style={{
          ...headIn,
          marginTop: 56,
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1.2,
          color: pal.text,
          maxWidth: 1400,
        }}
      >
        {kit.copy.hero.headline}
      </div>
    </SceneShell>
  );
};

const FeaturesScene: React.FC<{
  kit: CampaignBrandKit;
  pal: CmPalette;
  lengthInFrames: number;
}> = ({ kit, pal, lengthInFrames }) => {
  const features = kit.copy.features.slice(0, 3);
  const stagger = Math.max(14, Math.floor((lengthInFrames * 0.5) / Math.max(1, features.length)));
  return (
    <SceneShell>
      <div style={{ display: "flex", gap: 36 }}>
        {features.map((f, i) => (
          <FeatureCard
            key={f.title}
            index={i}
            emoji={f.emoji}
            title={f.title}
            delay={8 + i * stagger}
            nextDelay={8 + (i + 1) * stagger}
            isLast={i === features.length - 1}
            pal={pal}
          />
        ))}
      </div>
    </SceneShell>
  );
};

const FeatureCard: React.FC<{
  index: number;
  emoji: string;
  title: string;
  delay: number;
  nextDelay: number;
  isLast: boolean;
  pal: CmPalette;
}> = ({ index, emoji, title, delay, nextDelay, isLast, pal }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = springEnter(frame, fps, delay);

  // Active-card focus: the latest card is emphasized; once the next arrives it
  // eases down to 0.97 scale / 0.82 opacity over 12 frames.
  const focus = isLast
    ? 1
    : interpolate(frame, [nextDelay, nextDelay + 12], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const focusScale = 0.97 + focus * 0.03;
  const focusOpacity = 0.82 + focus * 0.18;

  const accent = wipeIn(frame, delay + 8, 14);
  const badgeScale = pop(frame, fps, delay + 16, { damping: 15, mass: 0.55 });

  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 380,
        padding: "56px 44px",
        borderRadius: 24,
        overflow: "hidden",
        background: pal.dark ? "rgba(255,255,255,0.96)" : "#ffffff",
        boxShadow: pal.dark ? "0 18px 50px rgba(0,0,0,0.34)" : "0 14px 40px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        opacity: s.opacity * focusOpacity,
        transform: `translateY(${s.translateY}px) scale(${s.scale * focusScale})`,
      }}
    >
      {/* Top accent bar — brand primary, wipes in left to right */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          background: pal.primary,
          transform: `scaleX(${accent})`,
          transformOrigin: "left center",
        }}
      />
      {/* Large low-opacity step index */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 40,
          fontSize: 70,
          fontWeight: 900,
          lineHeight: 1,
          color: "rgba(14,13,20,0.1)",
        }}
      >
        {`0${index + 1}`}
      </div>
      <div style={{ fontSize: 90, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "#14131a", lineHeight: 1.3 }}>
        {title}
      </div>
      {/* Check badge pops after the card lands */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#30a46c",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 900,
          transform: `scale(${badgeScale})`,
        }}
      >
        ✓
      </div>
    </div>
  );
};

const CtaScene: React.FC<{ kit: CampaignBrandKit; pal: CmPalette }> = ({ kit, pal }) => {
  const headIn = useEnter(0);
  const btnIn = useEnter(10);
  const logoIn = useEnter(18);
  return (
    <SceneShell>
      <div
        style={{
          ...headIn,
          fontSize: 72,
          fontWeight: 700,
          color: pal.text,
          maxWidth: 1400,
          lineHeight: 1.25,
        }}
      >
        {kit.copy.closing.headline}
      </div>
      <div
        style={{
          ...btnIn,
          marginTop: 64,
          background: pal.primary,
          color: pal.onPrimary,
          fontSize: 44,
          fontWeight: 700,
          borderRadius: 999,
          padding: "30px 84px",
        }}
      >
        {kit.copy.closing.cta_label}
      </div>
      <div style={{ ...logoIn, marginTop: 72 }}>
        <Logo kit={kit} height={56} pal={pal} />
      </div>
    </SceneShell>
  );
};

// ---------- captions (subtitle band) ----------

const Captions: React.FC<{ track: CmVoiceTrack }> = ({ track }) => {
  const frame = useCurrentFrame();
  const nowMs = (frame / CM_FPS) * 1000;
  const current = track.captions.find((c) => nowMs >= c.startMs && nowMs < c.endMs);
  if (!current) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 96,
          maxWidth: 1500,
          background: "rgba(10,12,20,0.82)",
          color: "#ffffff",
          fontSize: 38,
          lineHeight: 1.5,
          borderRadius: 18,
          padding: "18px 40px",
          textAlign: "center",
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};

// ---------- root ----------

/** Short scene-label chip text per role, derived from the kit's own copy. */
const chipLabel = (role: CmVoiceScene["role"], kit: CampaignBrandKit): string | null => {
  switch (role) {
    case "problem":
      return "こんなお悩みは？";
    case "solution":
      return kit.service.name;
    case "features":
      return "できること";
    case "cta":
      return "まずはここから";
    default:
      return null; // hook has no chip — the logo carries it
  }
};

const SCENE_COMPONENTS: Record<
  CmVoiceScene["role"],
  React.FC<{ kit: CampaignBrandKit; pal: CmPalette; lengthInFrames: number }>
> = {
  hook: ({ kit, pal }) => <HookScene kit={kit} pal={pal} />,
  problem: ProblemScene,
  solution: ({ kit, pal }) => <SolutionScene kit={kit} pal={pal} />,
  features: FeaturesScene,
  cta: ({ kit, pal }) => <CtaScene kit={kit} pal={pal} />,
};

export const CmComposition: React.FC<CmVideoProps> = ({ kit, track, audioSrc, bgmSrc }) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const pal = buildPalette(kit);

  // A scene stays on screen until the next one starts (gaps included).
  const sceneFrames = track.scenes.map((scene, i) => {
    const from = msToFrame(scene.startMs);
    const next = track.scenes[i + 1];
    const to = next ? msToFrame(next.startMs) : durationInFrames;
    return { scene, from, length: Math.max(1, to - from) };
  });

  // BGM fades out over the final second so it doesn't clip at the tail.
  const bgmVolume = interpolate(
    frame,
    [0, 18, durationInFrames - 30, durationInFrames],
    [0, 0.12, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ fontFamily: fontStack(kit), backgroundColor: pal.canvas }}>
      <CmBackground pal={pal} />
      {audioSrc && <Audio src={resolveMediaSrc(audioSrc)} />}
      {bgmSrc && <Audio src={resolveMediaSrc(bgmSrc)} volume={() => bgmVolume} loop />}
      {audioSrc && <Equalizer frame={frame} audioSrc={resolveMediaSrc(audioSrc)} pal={pal} />}
      {sceneFrames.map(({ scene, from, length }) => {
        const SceneComponent = SCENE_COMPONENTS[scene.role] ?? SCENE_COMPONENTS.hook;
        const label = chipLabel(scene.role, kit);
        return (
          <Sequence key={`${scene.role}-${from}`} from={from} durationInFrames={length}>
            <SceneComponent kit={kit} pal={pal} lengthInFrames={length} />
            {label && <CaptionChip label={label} pal={pal} />}
          </Sequence>
        );
      })}
      <Captions track={track} />
    </AbsoluteFill>
  );
};
