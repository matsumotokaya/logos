import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "013",
  slug: "material-study",
  title: "Material Study",
  category: "three",
  tech: ["three"],
  impressions: ["質感", "高級", "精密"],
  duration: "1素材 約3s(hold 2.2s + crossfade 0.8s) × 3種 = 約9sで1巡、以後ループ(自転は約48s/周)",
  supports: ["svg"],
  easing:
    "スタイル遷移: smoothstep(3t²-2t³)によるease-in-out。物理パラメータのlerpそのものをクロスフェードとして使う",
  notes:
    "同一の押し出しジオメトリ・同一のMeshPhysicalMaterialインスタンスを維持したまま、metal/glass/ceramicのmetalness・roughness・transmission・thickness・ior・clearcoat・clearcoatRoughness・envMapIntensity・色(ロゴ抽出色→白へのcolorMix)をuseFrame内でsmoothstep補間し、質感が滑らかに切り替わるcross-fadeを実現。transmission/clearcoatは常に0より僅かに大きい値を保ち、初回コンパイル時からシェーダのdefineを有効化(0のまま開始すると後から有効化できない問題を回避)。反射はdrei Environmentの子にLightformer(上部の大きな面光源+左右リム光+背面リング)を配置して合成し、preset/外部HDRは不使用(オフライン/CSP制約に対応)。主役はマテリアルの違いのため、回転は約48s/周と非常にゆっくりにとどめる。",
  status: "done",
};
