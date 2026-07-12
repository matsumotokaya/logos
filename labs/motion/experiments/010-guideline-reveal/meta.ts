import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "010",
  slug: "guideline-reveal",
  title: "Guideline Reveal",
  category: "presentation",
  tech: ["gsap", "svg"],
  impressions: ["設計的", "精密", "権威"],
  duration: "約2.1sで構築 + 静止保持",
  supports: ["svg"],
  easing:
    "draw: cubic-bezier(0.65, 0, 0.15, 1) / legend pop: cubic-bezier(0.19, 1, 0.22, 1) / ticks・ラベル: sine.out",
  notes:
    "ロゴを中央に静止させたまま、周囲にデザインガイドライン(製図)風の要素を線として順に描画する。構成グリッド→バウンディングボックス(アクセント紫)→クリアスペース寸法線(四辺・目盛り付き)→カラーパレットの凡例、の順でGSAP timelineを構築。オーバーレイSVGは0-100のviewBoxをpreserveAspectRatio=noneでステージに引き伸ばし、ロゴ本体の56%センターボックスと座標系を一致させている。テキスト(寸法ラベル・hexラベル)は非等比拡縮による歪みを避けるためHTML層に分離。ロゴ自体は一切変形しない。",
  status: "done",
};
