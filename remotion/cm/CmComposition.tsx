// The 30s CM video — problem-solution template (課題解決型), the first of the
// two fixed templates. Everything is driven by the Service Brand Kit and the
// voice track: scene boundaries come from the TTS mix (one cm_script scene =
// one sequence), on-screen text reuses the kit's LP copy, colors and logo are
// the brand's own. Consumed two ways with identical output:
//   - <Player> in /campaigns/[id]  (browser preview, no MP4 needed)
//   - `npm run campaign:render`    (local MP4 via the Remotion CLI)
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
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
// Relative imports on purpose: the Remotion CLI bundles this file with its
// own webpack config, which does not resolve the "@/" tsconfig alias.
import type { CampaignBrandKit } from "../../lib/campaign/schema";
import type { CmVoiceScene, CmVoiceTrack } from "../../lib/campaign/cm-types";
import { resolveTheme } from "../../lib/campaign/themes";

export const CM_FPS = 30;
export const CM_WIDTH = 1920;
export const CM_HEIGHT = 1080;
/** Silent tail so the last caption / audio sample is never cut off. */
export const CM_TAIL_MS = 500;

export interface CmVideoProps {
  kit: CampaignBrandKit;
  track: CmVoiceTrack;
  /** URL ("/..." or "http...") or a staticFile() name relative to publicDir. */
  audioSrc: string | null;
}

export const cmDurationInFrames = (track: CmVoiceTrack): number =>
  Math.max(1, Math.ceil(((track.totalMs + CM_TAIL_MS) / 1000) * CM_FPS));

const msToFrame = (ms: number): number => Math.round((ms / 1000) * CM_FPS);

const resolveAudioSrc = (src: string): string =>
  /^(https?:)?\//.test(src) ? src : staticFile(src);

// ---------- palette helpers ----------

interface CmPalette {
  canvas: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  surface: string;
  onPrimary: string;
  dark: boolean;
}

function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function buildPalette(kit: CampaignBrandKit): CmPalette {
  const theme = resolveTheme(kit);
  const glass = theme.lp.variant === "glass";
  // Glass themes get the dark cinematic canvas; flat themes keep the brand's
  // own background so the CM matches the LP.
  const canvas = glass ? "#0a0f1e" : kit.brand.background;
  const dark = glass || hexLuminance(canvas) < 0.45;
  return {
    canvas,
    text: dark ? "#ffffff" : kit.brand.text,
    muted: dark ? "rgba(255,255,255,0.65)" : `${kit.brand.text}99`,
    primary: kit.brand.primary,
    accent: kit.brand.accent,
    surface: dark ? "rgba(255,255,255,0.08)" : kit.brand.surface,
    onPrimary: hexLuminance(kit.brand.primary) < 0.55 ? "#ffffff" : "#111111",
    dark,
  };
}

const fontStack = (kit: CampaignBrandKit): string =>
  kit.brand.font_style === "elegant-serif"
    ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
    : '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';

// ---------- shared pieces ----------

const Canvas: React.FC<{ pal: CmPalette }> = ({ pal }) => {
  const frame = useCurrentFrame();
  const t = frame / CM_FPS;
  const x1 = 22 + Math.sin(t * 0.22) * 5;
  const y1 = 28 + Math.cos(t * 0.19) * 4;
  const x2 = 80 + Math.cos(t * 0.17) * 5;
  const y2 = 74 + Math.sin(t * 0.21) * 4;
  const glowAlpha = pal.dark ? "44" : "1f";
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(42% 52% at ${x1}% ${y1}%, ${pal.primary}${glowAlpha}, transparent 70%),
          radial-gradient(46% 56% at ${x2}% ${y2}%, ${pal.accent}${glowAlpha}, transparent 70%),
          ${pal.canvas}
        `,
      }}
    />
  );
};

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
    // Wordmark fallback — same philosophy as the LP header.
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
  const s = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 200, stiffness: 90 },
  });
  return {
    opacity: s,
    transform: `translateY(${interpolate(s, [0, 1], [36, 0])}px)`,
  };
};

const SceneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      padding: "120px 160px 200px",
      textAlign: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// ---------- scenes ----------

const hasLogoAsset = (kit: CampaignBrandKit): boolean =>
  Boolean(kit.assets?.logo_svg || kit.assets?.logo);

const HookScene: React.FC<{ kit: CampaignBrandKit; pal: CmPalette }> = ({ kit, pal }) => {
  const logoIn = useEnter(0);
  const nameIn = useEnter(10);
  // Without a real logo asset the Logo component falls back to a wordmark —
  // which would duplicate the service name shown right below it.
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
  // Points appear spread across the first ~70% of the scene.
  const stagger = Math.max(8, Math.floor((lengthInFrames * 0.7) / Math.max(1, points.length)));
  return (
    <SceneShell>
      <div style={{ ...headIn, fontSize: 64, fontWeight: 700, color: pal.text }}>
        {kit.copy.problem.headline}
      </div>
      <div style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 28 }}>
        {points.map((p, i) => (
          <ProblemPoint key={p} text={p} delay={12 + i * stagger} pal={pal} />
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
  const enter = useEnter(delay);
  return (
    <div
      style={{
        ...enter,
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: pal.surface,
        borderRadius: 24,
        padding: "28px 44px",
        fontSize: 42,
        color: pal.text,
        textAlign: "left",
      }}
    >
      <span style={{ color: pal.accent, fontWeight: 700 }}>✕</span>
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
  const stagger = Math.max(8, Math.floor((lengthInFrames * 0.5) / Math.max(1, features.length)));
  return (
    <SceneShell>
      <div style={{ display: "flex", gap: 40 }}>
        {features.map((f, i) => (
          <FeatureCard key={f.title} emoji={f.emoji} title={f.title} delay={i * stagger} pal={pal} />
        ))}
      </div>
    </SceneShell>
  );
};

const FeatureCard: React.FC<{
  emoji: string;
  title: string;
  delay: number;
  pal: CmPalette;
}> = ({ emoji, title, delay, pal }) => {
  const enter = useEnter(delay);
  return (
    <div
      style={{
        ...enter,
        width: 440,
        background: pal.surface,
        borderRadius: 32,
        padding: "64px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div style={{ fontSize: 96, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: pal.text, lineHeight: 1.3 }}>
        {title}
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

// ---------- captions ----------

const Captions: React.FC<{ track: CmVoiceTrack; pal: CmPalette }> = ({ track, pal }) => {
  const frame = useCurrentFrame();
  const nowMs = (frame / CM_FPS) * 1000;
  const current = track.captions.find((c) => nowMs >= c.startMs && nowMs < c.endMs);
  if (!current) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      <div
        style={{
          marginBottom: 72,
          maxWidth: 1500,
          background: pal.dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.9)",
          color: pal.dark ? "#ffffff" : "#111111",
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

export const CmComposition: React.FC<CmVideoProps> = ({ kit, track, audioSrc }) => {
  const { durationInFrames } = useVideoConfig();
  const pal = buildPalette(kit);

  // A scene stays on screen until the next one starts (gaps included).
  const sceneFrames = track.scenes.map((scene, i) => {
    const from = msToFrame(scene.startMs);
    const next = track.scenes[i + 1];
    const to = next ? msToFrame(next.startMs) : durationInFrames;
    return { scene, from, length: Math.max(1, to - from) };
  });

  return (
    <AbsoluteFill style={{ fontFamily: fontStack(kit), backgroundColor: pal.canvas }}>
      <Canvas pal={pal} />
      {audioSrc && <Audio src={resolveAudioSrc(audioSrc)} />}
      {sceneFrames.map(({ scene, from, length }) => {
        const SceneComponent = SCENE_COMPONENTS[scene.role] ?? SCENE_COMPONENTS.hook;
        return (
          <Sequence key={`${scene.role}-${from}`} from={from} durationInFrames={length}>
            <SceneComponent kit={kit} pal={pal} lengthInFrames={length} />
          </Sequence>
        );
      })}
      <Captions track={track} pal={pal} />
    </AbsoluteFill>
  );
};
