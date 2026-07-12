import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "001",
  slug: "classic-reveal",
  title: "Classic Reveal",
  category: "reveal",
  tech: ["gsap", "svg"],
  impressions: ["ミニマル", "端正", "荘厳"],
  duration: "約2.8sで定着 + 10sドリフト",
  supports: ["svg"],
  easing:
    "draw: cubic-bezier(0.70, 0, 0.18, 1) / settle: cubic-bezier(0.16, 1, 0.30, 1) / drift: power1.inOut",
  notes:
    "基準器。輪郭線ドロー→塗り→微スケール定着→10秒かけて+10%の等比ドリフト。以後の実験はすべてこれと見比べて評価する。",
  status: "done",
};
