"use client";

// One video-pipeline stage, opened over the video page. Read-only by design
// (deliverable-architecture §17.6): the actions live on the surfaces they
// belong to (the brief editor, the template picker, the render button), so
// this drawer is the place to see what each stage produced and what it is
// waiting on — not the place to do the work.

import type { GoalField, GoalProgress, PipelineStageId } from "@/lib/pipeline/stages";

function StatusBadge({ status }: { status: "empty" | "ready" | "stale" }) {
  const map = {
    empty: { dot: "bg-hairline", label: "未実行", text: "text-ink-muted" },
    ready: { dot: "bg-emerald-500", label: "最新", text: "text-emerald-700" },
    stale: { dot: "bg-amber-500", label: "要更新", text: "text-amber-700" },
  } as const;
  const tone = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone.text}`}>
      <span className={`size-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      {tone.label}
    </span>
  );
}

function FieldRow({
  field,
  tone,
}: {
  field: GoalField;
  tone: "filled" | "missing";
}) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span
        aria-hidden="true"
        className={
          tone === "filled"
            ? "size-1.5 rounded-full bg-emerald-500"
            : "size-1.5 rounded-full bg-amber-500"
        }
      />
      <span className="text-ink">{field.label}</span>
      {field.required && (
        <span className="rounded bg-ink/5 px-1.5 text-[10px] text-ink-muted">
          必須
        </span>
      )}
      <span className="ml-auto font-mono text-[11px] text-ink-faint">
        {field.path}
      </span>
    </li>
  );
}

export interface VideoPipelinePayload {
  stages: Array<{
    id: PipelineStageId;
    label: string;
    status: "empty" | "ready" | "stale";
    summary: string;
    producedAt: string | null;
  }>;
  goal: GoalProgress;
}

const STAGE_DESCRIPTION: Record<PipelineStageId, string> = {
  input: "動画のブリーフが take に書かれているか。書かれていないと先には進めません。",
  extract: "画像・音声などから素材を取り出す段階。動画では将来のための予約枠です。",
  structure: "ブリーフがテンプレートのスキーマに沿っているか。必須項目が埋まっているかを一覧します。",
  map: "テンプレート (event-promo / product-cm) が適用されているか。",
  output: "Remotion でMP4が書き出されたか。失敗・実行中・成功をここで区別します。",
};

export default function VideoPipelinePanel({
  stageId,
  payload,
}: {
  stageId: PipelineStageId;
  payload: VideoPipelinePayload;
}) {
  const stage = payload.stages.find((item) => item.id === stageId);
  const filled = payload.goal.filled;
  const missing = payload.goal.missing;
  const missingRequired = payload.goal.missingRequired;

  return (
    <div className="flex flex-col gap-6">
      {stage ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-ink">{stage.label} の状態</h3>
            <StatusBadge status={stage.status} />
          </div>
          <p className="text-sm text-ink-muted">{stage.summary}</p>
          <p className="text-xs text-ink-faint">{STAGE_DESCRIPTION[stage.id]}</p>
          {stage.producedAt ? (
            <p className="font-mono text-[11px] text-ink-faint">
              最終更新: {new Date(stage.producedAt).toLocaleString("ja-JP")}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-ink-faint">まだ更新されていません</p>
          )}
        </section>
      ) : null}

      {stageId === "structure" ? (
        <section className="flex flex-col gap-3 border-t border-hairline pt-5">
          <div>
            <h3 className="text-sm font-medium text-ink">
              採用済み ({filled.length}項目)
            </h3>
            {filled.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {filled.map((field) => (
                  <FieldRow key={field.path} field={field} tone="filled" />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">
                まだ何も採用されていません
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-ink">
              不足 ({missing.length}項目)
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              この一覧が、次に取りに行くものです。
            </p>
            {missing.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {missing.map((field) => (
                  <FieldRow key={field.path} field={field} tone="missing" />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">不足はありません</p>
            )}
          </div>
        </section>
      ) : null}

      {stageId === "output" ? (
        <section className="flex flex-col gap-2 border-t border-hairline pt-5">
          <h3 className="text-sm font-medium text-ink">MP4を作る</h3>
          <p className="text-sm text-ink-muted">
            レンダー操作はこのドロワーの外(ページ本体の「MP4を作成」ボタン)から行います。
            ここを開いている間は、書き出しの進行はそのままで確認できます。
          </p>
          {missingRequired.length > 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              必須項目が{missingRequired.length}件不足しています。
              {missingRequired.map((field) => field.label).join("、")}
              を先に確定してください。
            </p>
          ) : null}
        </section>
      ) : null}

      {stageId === "map" ? (
        <section className="flex flex-col gap-2 border-t border-hairline pt-5">
          <h3 className="text-sm font-medium text-ink">テンプレート</h3>
          <p className="text-sm text-ink-muted">
            テンプレートの切り替えはブリーフ編集画面から行います。パイプライン上は選択中のテンプレートを表示するだけです。
          </p>
        </section>
      ) : null}

      {stageId === "extract" ? (
        <section className="flex flex-col gap-2 border-t border-hairline pt-5">
          <h3 className="text-sm font-medium text-ink">抽出</h3>
          <p className="text-sm text-ink-muted">
            動画向けの素材抽出(音声・B-roll・色など)は将来の拡張ポイントです。今は未実装のままで、構造化以降の段で十分作れるように設計されています。
          </p>
        </section>
      ) : null}
    </div>
  );
}