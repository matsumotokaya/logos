import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "006",
  slug: "gradient-sweep",
  title: "Gradient Sweep",
  category: "texture",
  tech: ["gsap", "css"],
  impressions: ["上質", "光沢", "静謐"],
  duration: "約1.4sで一度だけ走査",
  supports: ["svg", "png"],
  easing: "sweep: power2.inOut(斜めのハイライトが一度だけ横切る)",
  notes:
    "ロゴのシルエットにマスクした光の帯(白の斜めグラデ)を一度だけ横切らせ、金属光沢の質感を与える。ロゴは静止し、ハイライト層をscreen合成で重ねるのみ。マスクにロゴのデータURIを使うためPNGも可。派手にせず、艶を一瞬感じさせる程度に留める。",
  status: "done",
};
