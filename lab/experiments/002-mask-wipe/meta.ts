import type { ExperimentMeta } from "@/lab/core/experiment-api";

export const meta: ExperimentMeta = {
  id: "002",
  slug: "mask-wipe",
  title: "Mask Wipe",
  category: "reveal",
  tech: ["gsap", "css"],
  impressions: ["建築的", "端正", "ミニマル"],
  duration: "約1.9sワイプ(その後静止)",
  supports: ["svg", "png"],
  easing: "wipe: cubic-bezier(0.62, 0, 0.14, 1)(遅→速→ゆっくり止まる)",
  notes:
    "ソフトエッジのグラデーションマスクが左→右に走査し、ロゴを縁から立ち上げる。スケール・変形は一切なし。中心→外のradialバリエーションも同構造で追加可能。マスクはコンテナ全体に掛かるためPNGも可。",
  status: "done",
};
