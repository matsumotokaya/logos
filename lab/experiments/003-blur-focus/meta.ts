import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "003",
  slug: "blur-focus",
  title: "Blur Focus",
  category: "reveal",
  tech: ["gsap", "css"],
  impressions: ["静謐", "上質", "写真的"],
  duration: "約2.1sフォーカス(その後静止)",
  supports: ["svg", "png"],
  easing: "focus: cubic-bezier(0.16, 1, 0.30, 1)(素早く寄って静かに止まる)",
  notes:
    "大きくぼけた+わずかに大きい状態から、ピントが合いながら等比で定着する。ブラー量はキャンバス幅に比例させ、カードでもモーダルでも同じ見え方を保つ。スケールは等比のみでロゴを歪めない。PNGも可。",
  status: "done",
};
