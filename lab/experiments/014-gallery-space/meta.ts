import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "014",
  slug: "gallery-space",
  title: "Gallery Space",
  category: "three",
  tech: ["three"],
  impressions: ["荘厳", "空間的", "権威"],
  duration: "12s×2(往復24s)の緩やかなドリー+わずかなトラック",
  supports: ["svg", "png"],
  easing:
    "camera dolly: custom easeInOutCubic。12秒かけて額に寄り、12秒かけて起点へ戻るループ(スナップリセットではなく往復)",
  notes:
    "ロゴをCanvasTextureとして白マットに焼き込み(ラボの62%クリアスペース基準をそのままベイク時の余白に適用)、4本のBoxGeometryバーで額装して壁に掛ける。壁・床はニュートラルな無彩色マテリアルのみで、ambientLight+directionalLight+target付きspotLightで額を上品に照らす。カメラは常に額の中心を注視しつつ、easeInOutCubicでドリーイン/アウトを往復。SVG/PNGどちらもlogoToImage経由でテクスチャ化するため両対応。",
  status: "done",
};
