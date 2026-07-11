import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "005",
  slug: "particle-assemble",
  title: "Particle Assemble",
  category: "reveal",
  tech: ["canvas"],
  impressions: ["先進的", "テック", "軽快"],
  duration: "約2.0sで集合(その後静止)",
  supports: ["svg", "png"],
  easing: "gather: easeOutCubic(散開位置から目標へ、距離で微スタガー)",
  notes:
    "ロゴをラスタライズしてグリッドサンプリングした点群を粒子とし、散らばった状態から集まってロゴを形成する。粒子の色はロゴ自身のピクセル色(パレット原則を自動で満たす)。集合後は実ロゴをクリスプに重ねて定着。DPR対応でカード/モーダルとも鮮明。",
  status: "done",
};
