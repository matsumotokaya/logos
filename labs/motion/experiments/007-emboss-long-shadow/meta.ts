import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "007",
  slug: "emboss-long-shadow",
  title: "Emboss / Long Shadow",
  category: "texture",
  tech: ["gsap", "css"],
  impressions: ["立体", "陰影", "上質"],
  duration: "静的な陰影 + 約9sの光源ドリフト(ループ)",
  supports: ["svg", "png"],
  easing: "light-drift: sine.inOut(光源角がごく僅かに揺れる)",
  notes:
    "無彩色のドロップシャドウを重ねてフェードするロングシャドウを付与し、光源を感じさせる。ロゴ自体は静止し、光源角だけが±で極めてゆっくり揺れる(微アニメ)。影の長さはキャンバス幅に比例。色は無彩色のみ。SVG/PNG両対応。",
  status: "done",
};
