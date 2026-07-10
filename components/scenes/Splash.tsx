"use client";

// Splash — page 1 (cover) of the generated brand-guidelines document.
// The logo draws itself into existence: stroke draw-on, ink fill, settle.

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useI18n } from "@/lib/i18n";
import type { SceneProps } from "./shared";

const INK = "#101012";
/** Outline draw-on, eased slow → fast → slow. */
const DRAW_DURATION = 1.5;
/** After the mark completes it blooms by this factor over BLOOM_DURATION
 *  seconds, then the loop refreshes with a fresh draw. */
const BLOOM_DURATION = 10;
const BLOOM_SCALE = 1.1;
/** Above this shape count, draw in grouped chunks to stay at 60fps. */
const CHUNK_LIMIT = 120;
const CHUNK_GROUPS = 24;

type DrawShape = {
  el: SVGGeometryElement;
  len: number;
  fill: string;
  stroke: string | null;
  strokeWidth: string | null;
};

export default function Splash({ logo, name }: SceneProps) {
  const { dict } = useI18n();
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const inViewRef = useRef(true);
  const playingRef = useRef(true);
  const playRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(true);
  const year = new Date().getFullYear();

  const play = useCallback(() => {
    const host = hostRef.current;
    const section = sectionRef.current;
    if (!host || !section) return;

    tlRef.current?.kill();
    tlRef.current = null;

    // Fresh mount so every run (and every new logo) starts from the pristine
    // baked SVG. Upstream analysis already sanitized it.
    host.innerHTML = logo.svg;
    const svg = host.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    // Always contain the mark inside its box, whatever aspect ratio it has,
    // so a wide wordmark and a square icon read at a consistent size.
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";

    const metaEls = Array.from(
      section.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Skip straight to the final composed state.
      gsap.set(metaEls, { clearProps: "opacity,transform" });
      return;
    }

    // --- classify shapes ---------------------------------------------------
    const allShapes = Array.from(
      svg.querySelectorAll<SVGElement>(
        "path, rect, circle, ellipse, polygon, polyline, line, text"
      )
    );
    const drawable: DrawShape[] = [];
    const fadeOnly: SVGElement[] = [];

    for (const el of allShapes) {
      let len = 0;
      if (el instanceof SVGGeometryElement) {
        try {
          len = el.getTotalLength();
        } catch {
          len = 0; // degenerate shape — skip draw-on
        }
      }
      if (Number.isFinite(len) && len > 0) {
        drawable.push({
          el: el as SVGGeometryElement,
          len,
          fill: el.getAttribute("fill") ?? INK,
          stroke: el.getAttribute("stroke"),
          strokeWidth: el.getAttribute("stroke-width"),
        });
      } else {
        fadeOnly.push(el);
      }
    }

    // --- prepare: hide fills, apply temporary draw strokes ------------------
    const fillTargets: SVGElement[] = [];
    for (const s of drawable) {
      const painted = s.fill !== "none";
      if (painted) {
        s.el.style.fillOpacity = "0";
        fillTargets.push(s.el);
      }
      const strokeColor =
        painted && !s.fill.startsWith("url(")
          ? s.fill
          : s.stroke && s.stroke !== "none"
            ? s.stroke
            : INK;
      s.el.style.stroke = strokeColor;
      s.el.style.strokeWidth = "1.25";
      s.el.style.strokeOpacity = "1";
      s.el.setAttribute("vector-effect", "non-scaling-stroke");
      s.el.style.strokeDasharray = String(s.len);
      s.el.style.strokeDashoffset = String(s.len);
    }
    for (const el of fadeOnly) {
      el.style.fillOpacity = "0";
      fillTargets.push(el);
    }

    // Longest paths lead the draw.
    drawable.sort((a, b) => b.len - a.len);
    const groups: SVGElement[][] = [];
    if (drawable.length > CHUNK_LIMIT) {
      const size = Math.ceil(drawable.length / CHUNK_GROUPS);
      for (let i = 0; i < drawable.length; i += size) {
        groups.push(drawable.slice(i, i + size).map((s) => s.el));
      }
    } else {
      for (const s of drawable) groups.push([s.el]);
    }

    // --- timeline ------------------------------------------------------------
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: () => {
        // Strip the temporary draw styles; keep DOM as the baked master.
        for (const s of drawable) {
          s.el.removeAttribute("style");
          s.el.removeAttribute("vector-effect");
        }
        for (const el of fadeOnly) el.removeAttribute("style");
        // Loop while playing and on-screen; else settle to the clean mark.
        if (playingRef.current && inViewRef.current) {
          requestAnimationFrame(() => playRef.current());
        } else {
          gsap.set(svg, { clearProps: "transform" });
        }
      },
    });
    tlRef.current = tl;

    gsap.set(metaEls, { opacity: 0, y: 10 });

    // Phase 1 — draw-on: dashoffset -> 0, staggered, longest first. Each
    // stroke eases slow → fast → slow so the mark writes itself smoothly.
    const n = groups.length;
    const each = n > 1 ? Math.min(0.1, 1 / (n - 1)) : 0;
    groups.forEach((group, i) => {
      tl.to(
        group,
        { strokeDashoffset: 0, duration: DRAW_DURATION, ease: "power2.inOut" },
        0.15 + i * each
      );
    });
    const drawEnd = n > 0 ? 0.15 + (n - 1) * each + DRAW_DURATION : 0.3;
    const inkAt = Math.max(drawEnd - 0.45, 0.4);

    // Phase 2 — ink fill: fills fade back in, temporary strokes fade away.
    if (fillTargets.length) {
      tl.to(
        fillTargets,
        { fillOpacity: 1, duration: 0.8, ease: "power1.inOut" },
        inkAt
      );
    }
    const tempStroked = drawable
      .filter((s) => !s.stroke || s.stroke === "none")
      .map((s) => s.el);
    if (tempStroked.length) {
      tl.to(
        tempStroked,
        { strokeOpacity: 0, duration: 0.6, ease: "power1.out" },
        inkAt + 0.25
      );
    }
    const restroked = drawable.filter((s) => s.stroke && s.stroke !== "none");
    if (restroked.length) {
      tl.to(
        restroked.map((s) => s.el),
        {
          strokeWidth: (i: number) =>
            parseFloat(restroked[i].strokeWidth || "1") || 1,
          duration: 0.5,
          ease: "power1.inOut",
        },
        inkAt + 0.25
      );
    }

    // Phase 3 — settle: subtle scale on the mark, then the meta lines.
    tl.fromTo(
      svg,
      { scale: 1.03, transformOrigin: "50% 50%" },
      { scale: 1, duration: 0.7, ease: "power2.out" },
      inkAt + 0.2
    );
    tl.to(
      metaEls,
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.07 },
      inkAt + 0.6
    );

    // Phase 4 — bloom: hold, then a slow +10% zoom over BLOOM_DURATION.
    // When it finishes, onComplete refreshes into a fresh draw.
    tl.to(
      svg,
      {
        scale: BLOOM_SCALE,
        transformOrigin: "50% 50%",
        duration: BLOOM_DURATION,
        ease: "sine.inOut",
      },
      inkAt + 1.4
    );
  }, [logo.svg]);

  // Stop settles the current run to the finished mark; Play resumes the loop.
  const toggle = useCallback(() => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    // Stopping mid-run: jump to the end so onComplete settles the clean mark
    // and, seeing playing=false, does not loop.
    if (!next) tlRef.current?.progress(1);
  }, []);

  // Keep the play fn reachable from the timeline's onComplete (which loops).
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  // Start the loop while playing. Each run self-schedules the next from its
  // onComplete; reduced motion shows the composed mark once and never loops.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      play();
      return;
    }
    if (playing) play();
  }, [playing, play]);

  // Pause the loop off-screen (onComplete won't re-arm); resume on return.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        if (
          entry.isIntersecting &&
          playingRef.current &&
          !tlRef.current?.isActive()
        ) {
          playRef.current();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  // Kill any in-flight timeline on unmount.
  useEffect(
    () => () => {
      tlRef.current?.kill();
      tlRef.current = null;
    },
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-dvh flex-col overflow-hidden bg-paper text-ink"
    >
      <header className="flex min-w-0 items-baseline justify-between gap-6 border-b border-hairline px-6 py-5 md:px-10">
        <p data-reveal className="truncate font-mono text-xs uppercase">
          {name}
        </p>
        <p
          data-reveal
          className="shrink-0 font-mono text-xs uppercase text-ink-muted"
        >
          {dict.doc.brandGuidelines}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
        <div
          ref={hostRef}
          role="img"
          aria-label={`${name} logo`}
          className="mx-auto h-[22vh] w-full max-w-4xl md:h-[26vh]"
        />
        {/* Always-on transport control — a fixed player affordance, not part
            of the reveal. Toggles the auto-replay loop. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? dict.splash.pause : dict.splash.play}
          className="flex size-9 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:border-ink"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
              <rect x="6.5" y="5" width="4" height="14" rx="0.5" />
              <rect x="13.5" y="5" width="4" height="14" rx="0.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l10-6.5z" />
            </svg>
          )}
        </button>
      </div>

      <footer className="flex items-baseline justify-between gap-6 border-t border-hairline px-6 py-5 md:px-10">
        <p
          data-reveal
          className="font-mono text-xs uppercase text-ink-muted tabular-nums"
        >
          {dict.doc.version} 1.0 — {year}
        </p>
        <p data-reveal className="font-mono text-xs uppercase text-ink-muted">
          {dict.splash.scrollCue} ↓
        </p>
      </footer>
    </section>
  );
}
