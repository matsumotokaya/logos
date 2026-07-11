import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "004",
  slug: "path-stagger",
  title: "Path Stagger",
  category: "reveal",
  tech: ["gsap", "svg"],
  impressions: ["構築的", "軽快", "端正"],
  duration: "約1.8sで構築(パス数に応じ伸縮)",
  supports: ["svg"],
  easing: "settle: cubic-bezier(0.22, 1, 0.30, 1)(各パスが素早く出て静かに定着)",
  notes:
    "ロゴを構成する各パス/シェイプが、それぞれの中心から時間差で立ち上がる(transform-box:fill-box で各要素の重心を基準に等比スケール)。ワードマークでは字が一つずつ、シンボルでは要素が順に組み上がる。歪みなし。パス構造が読めるSVG専用。",
  status: "done",
};
