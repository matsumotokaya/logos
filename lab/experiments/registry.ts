"use client";

// The experiment catalog. Implemented experiments pair a meta with a
// lazily-loaded component (heavy deps like three/lottie stay out of the
// initial bundle); planned ones carry meta only and render as placeholders.

import dynamic from "next/dynamic";
import type { ExperimentMeta } from "@/lab/core/experiment-api";
import type { ExperimentComponent } from "@/lab/core/experiment-api";
import { meta as classicReveal } from "./001-classic-reveal/meta";
import { meta as maskWipe } from "./002-mask-wipe/meta";
import { meta as blurFocus } from "./003-blur-focus/meta";

export type ExperimentEntry = {
  meta: ExperimentMeta;
  Component?: ExperimentComponent;
};

// NOTE: do not collect components in a Record keyed by "001"-style strings —
// Turbopack's production optimizer constant-folds such lookups to undefined
// (leading-zero keys). Assign components directly to their entry.

/** Roadmap stubs — implemented one by one, each judged against 001. */
const planned: ExperimentMeta[] = [
  {
    id: "004",
    slug: "path-stagger",
    title: "Path Stagger",
    category: "reveal",
    tech: ["gsap", "svg"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "005",
    slug: "particle-assemble",
    title: "Particle Assemble",
    category: "reveal",
    tech: ["canvas"],
    impressions: [],
    duration: "—",
    supports: ["svg", "png"],
    status: "planned",
  },
  {
    id: "006",
    slug: "gradient-sweep",
    title: "Gradient Sweep",
    category: "texture",
    tech: ["gsap", "svg"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "007",
    slug: "emboss-long-shadow",
    title: "Emboss / Long Shadow",
    category: "texture",
    tech: ["svg", "css"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "008",
    slug: "breathing",
    title: "Breathing",
    category: "ambient",
    tech: ["gsap"],
    impressions: [],
    duration: "—",
    supports: ["svg", "png"],
    status: "planned",
  },
  {
    id: "009",
    slug: "ambient-background",
    title: "Ambient Background",
    category: "ambient",
    tech: ["css", "canvas"],
    impressions: [],
    duration: "—",
    supports: ["svg", "png"],
    status: "planned",
  },
  {
    id: "010",
    slug: "guideline-reveal",
    title: "Guideline Reveal",
    category: "presentation",
    tech: ["gsap", "svg"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "011",
    slug: "lockup-variations",
    title: "Lockup Variations",
    category: "presentation",
    tech: ["gsap", "svg"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "012",
    slug: "extrude-turntable",
    title: "Extrude Turntable",
    category: "three",
    tech: ["three"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "013",
    slug: "material-study",
    title: "Material Study",
    category: "three",
    tech: ["three"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "014",
    slug: "gallery-space",
    title: "Gallery Space",
    category: "three",
    tech: ["three"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "015",
    slug: "lottie-roundtrip",
    title: "Lottie 往復検証",
    category: "export",
    tech: ["lottie"],
    impressions: [],
    duration: "—",
    supports: ["svg"],
    status: "planned",
  },
  {
    id: "016",
    slug: "video-export-hook",
    title: "動画書き出しフック",
    category: "export",
    tech: ["canvas"],
    impressions: [],
    duration: "—",
    supports: ["svg", "png"],
    status: "planned",
  },
];

const implemented: ExperimentEntry[] = [
  {
    meta: classicReveal,
    Component: dynamic(() => import("./001-classic-reveal"), { ssr: false }),
  },
  {
    meta: maskWipe,
    Component: dynamic(() => import("./002-mask-wipe"), { ssr: false }),
  },
  {
    meta: blurFocus,
    Component: dynamic(() => import("./003-blur-focus"), { ssr: false }),
  },
];

export const experiments: ExperimentEntry[] = [
  ...implemented,
  ...planned.map((meta) => ({ meta })),
].sort((a, b) => a.meta.id.localeCompare(b.meta.id));

export function getExperiment(id: string): ExperimentEntry | undefined {
  return experiments.find((e) => e.meta.id === id);
}
