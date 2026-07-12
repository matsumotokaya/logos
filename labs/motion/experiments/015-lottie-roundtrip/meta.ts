import type { ExperimentMeta } from "@/labs/motion/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "015",
  slug: "lottie-roundtrip",
  title: "Lottie 往復検証",
  category: "export",
  tech: ["lottie", "gsap"],
  impressions: ["検証", "互換性"],
  duration: "約2.5sループ(左右同時再生で忠実度を比較)",
  supports: ["svg", "png"],
  easing: "両版とも cubic-bezier(0.16, 1, 0.30, 1)(コード側=gsap / Lottie側=キーフレームのi/oハンドルに同値を設定)",
  notes:
    "代表的な動き(フェード+スケール定着)をLottie形式へ往復させ忠実度を確認する検証枠。左=コード実行版(gsap)、右=Lottie版(lottie-webでJSONを再生)を左右に並べ同時再生。ロゴはPNGラスタライズしてLottieのimageアセット(埋め込みbase64)に載せ、任意ロゴでも往復できるようにしている。イージングは両版で同一cubic-bezierに揃え、ズレが出ないか比較。制約: Lottieはtransform/opacity/マスク等は忠実だが、CSS filterのblur・Canvas粒子・Three.jsは変換不可(=Lottie化できる実験は限られる)。ベクター形状ではなく画像埋め込みのため解像度は書き出し時に固定される点も検証対象。",
  status: "done",
};
