import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "008",
  slug: "breathing",
  title: "Breathing",
  category: "ambient",
  tech: ["gsap"],
  impressions: ["静謐", "生命感", "ミニマル"],
  duration: "約9sループ(拡縮 約2.5%)",
  supports: ["svg", "png"],
  easing: "breath: sine.inOut(拡張と収縮で対称)",
  notes:
    "知覚できるかできないかの境目の、ごく僅かな等比拡縮を無限ループさせる常駐表現。振幅は約2.5%に抑え、ロゴが静かに息づいて見える程度に留める。歪みなし。プレゼンの常駐状態や待機画面向け。SVG/PNG両対応。",
  status: "done",
};
