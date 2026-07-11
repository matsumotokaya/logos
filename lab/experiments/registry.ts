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
import { meta as pathStagger } from "./004-path-stagger/meta";
import { meta as particleAssemble } from "./005-particle-assemble/meta";
import { meta as gradientSweep } from "./006-gradient-sweep/meta";
import { meta as embossLongShadow } from "./007-emboss-long-shadow/meta";
import { meta as breathing } from "./008-breathing/meta";
import { meta as ambientBackground } from "./009-ambient-background/meta";
import { meta as guidelineReveal } from "./010-guideline-reveal/meta";
import { meta as lockupVariations } from "./011-lockup-variations/meta";

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
  {
    meta: pathStagger,
    Component: dynamic(() => import("./004-path-stagger"), { ssr: false }),
  },
  {
    meta: particleAssemble,
    Component: dynamic(() => import("./005-particle-assemble"), { ssr: false }),
  },
  {
    meta: gradientSweep,
    Component: dynamic(() => import("./006-gradient-sweep"), { ssr: false }),
  },
  {
    meta: embossLongShadow,
    Component: dynamic(() => import("./007-emboss-long-shadow"), { ssr: false }),
  },
  {
    meta: breathing,
    Component: dynamic(() => import("./008-breathing"), { ssr: false }),
  },
  {
    meta: ambientBackground,
    Component: dynamic(() => import("./009-ambient-background"), { ssr: false }),
  },
  {
    meta: guidelineReveal,
    Component: dynamic(() => import("./010-guideline-reveal"), { ssr: false }),
  },
  {
    meta: lockupVariations,
    Component: dynamic(() => import("./011-lockup-variations"), { ssr: false }),
  },
];

export const experiments: ExperimentEntry[] = [
  ...implemented,
  ...planned.map((meta) => ({ meta })),
].sort((a, b) => a.meta.id.localeCompare(b.meta.id));

export function getExperiment(id: string): ExperimentEntry | undefined {
  return experiments.find((e) => e.meta.id === id);
}
