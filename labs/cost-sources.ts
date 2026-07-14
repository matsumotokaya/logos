// Cost sources — the single catalog of every external API that costs money.
//
// This is the seed of a future monthly cost dashboard. For now it is a static
// declaration ("what do we pay for, and where"); later, `metered` sources are
// aggregated live from their JSONL job logs into a monthly total. Keep this
// list authoritative: a new paid API must be added here, so the cost surface
// never drifts from reality.
//
// Verified 2026-07-14 by code audit: the product calls exactly these paid
// APIs. No text LLM (OpenAI / Anthropic / etc.) is used anywhere — auto copy
// is deterministic/template-based, not model-generated.

export type CostStatus = "active" | "planned";

export type CostSource = {
  id: string;
  /** Product/model name shown in the table. */
  name: string;
  /** Who bills us. */
  provider: string;
  /** What we use it for (feature + which lab / main app). */
  usedFor: string;
  /** Where in the code it is called. */
  where: string;
  /** Unit price string. Mark 目安 when not contractually pinned. */
  unitCost: string;
  /** per-call = usage-based per generation; infra = platform/monthly. */
  billing: "per-call" | "infra";
  status: CostStatus;
  /** True when per-job cost is already logged (a live-dashboard data source). */
  metered: boolean;
  /** JSONL job log path, when metered — the future aggregation input. */
  jobLog?: string;
  /** Contract / data-retention note worth surfacing. */
  note?: string;
};

export const COST_SOURCES: CostSource[] = [
  {
    id: "gemini-flash-image",
    name: "Gemini 2.5 Flash Image (Nano Banana)",
    provider: "Google AI Studio",
    usedFor: "本体プレゼン シーン10: マグ/トート/キャップ等の写実モックアップ生成",
    where: "app/api/generate",
    unitCost: "≈ $0.039 / 枚(目安)",
    billing: "per-call",
    status: "active",
    metered: false,
    note: "原価ログ未実装。月次ダッシュボード化の前にここへ計測を足す必要がある",
  },
  {
    id: "together-flux2",
    name: "FLUX.2 [pro]",
    provider: "Together AI",
    usedFor: "Generative Lab 主エンジン(世界構築): マテリアル変換・環境統合",
    where: "labs/generative(engine=flux2)",
    unitCost: "$0.03 / 枚(実測)",
    billing: "per-call",
    status: "active",
    metered: true,
    jobLog: "var/generative-lab/jobs.jsonl",
    note: "ZDR既定・学習利用opt-inでオフ。BFL直APIは規約上不可(必ずTogether経由)",
  },
  {
    id: "recraft",
    name: "Recraft V4.1 / V3",
    provider: "Recraft",
    usedFor: "Generative Lab 派生生成機(造形展開): パターン・背景・ベクター系",
    where: "labs/generative(engine=recraft)",
    unitCost: "$0.035 / 枚(実測)",
    billing: "per-call",
    status: "active",
    metered: true,
    jobLog: "var/generative-lab/jobs.jsonl",
    note: "API入出力を学習に使わない明文規定。生成物URLは約24h公開→即時回収済み",
  },
  {
    id: "vertex-gemini3-image",
    name: "Gemini 3 Pro Image",
    provider: "Google Vertex AI",
    usedFor: "Generative Lab 対話修正層(アートディレクター): マルチターン編集",
    where: "labs/generative(engine=gemini・E3スタブ)",
    unitCost: "未接続(Phase E3で計測開始)",
    billing: "per-call",
    status: "planned",
    metered: false,
    note: "IP補償対象のVertex AI経由。現状は未配線のため課金なし",
  },
  {
    id: "supabase",
    name: "Supabase(DB / Auth / Storage)",
    provider: "Supabase",
    usedFor: "アカウント・組織・ロゴ正本の永続化とストレージ(本体全体)",
    where: "lib/supabase",
    unitCost: "従量 / 月額(現状 無料枠内)",
    billing: "infra",
    status: "active",
    metered: false,
    note: "per-call ではなくインフラ課金。月次ダッシュボードでは別枠(基盤費)で扱う",
  },
];
