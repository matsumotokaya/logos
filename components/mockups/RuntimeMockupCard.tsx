"use client";

import { useEffect, useState } from "react";
import type { SceneProps } from "@/components/scenes/shared";
import { repo, type AssetRun, type AssetRunStatus } from "@/lib/store";

type RuntimeOutputState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "empty" }
  | { status: "queued" | "running"; run: AssetRun }
  | { status: "failed"; message: string | null; run: AssetRun }
  | { status: "processed" | "canceled"; run: AssetRun }
  | { status: "done"; image: string; run: AssetRun | null }
  | { status: "error" };

type RuntimeRequestDetails = {
  familyId: string;
  version: number;
  params?: Record<string, unknown>;
};

export default function RuntimeMockupCard({
  scene,
  assetId,
  label,
  requestDetails,
}: {
  scene: SceneProps;
  assetId: string;
  label: string;
  requestDetails?: RuntimeRequestDetails;
}) {
  const [state, setState] = useState<RuntimeOutputState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!scene.mockupLogoId || !scene.mockupCandidateId) {
      Promise.resolve().then(() => {
        if (alive) setState({ status: "unavailable" });
      });
      return () => {
        alive = false;
      };
    }

    const candidateId = scene.mockupCandidateId;
    Promise.allSettled([
      repo.getMockups(scene.mockupLogoId, candidateId),
      repo.getLatestAssetRun(candidateId, assetId),
    ]).then(([outputsResult, runResult]) => {
        if (!alive) return;
        const output =
          outputsResult.status === "fulfilled"
            ? outputsResult.value[assetId]
            : undefined;
        const run = runResult.status === "fulfilled" ? runResult.value : null;
        if (output) {
          setState({ status: "done", image: output, run });
          return;
        }
        if (run?.status === "queued" || run?.status === "running") {
          setState({ status: run.status, run });
          timer = setTimeout(() => {
            if (alive) setRefreshKey((value) => value + 1);
          }, 4000);
          return;
        }
        if (run?.status === "failed") {
          setState({ status: "failed", message: run.errorMessage, run });
          return;
        }
        if (run?.status === "succeeded") {
          setState({ status: "processed", run });
          return;
        }
        if (run?.status === "canceled") {
          setState({ status: "canceled", run });
          return;
        }
        if (
          outputsResult.status === "rejected" &&
          runResult.status === "rejected"
        ) {
          setState({ status: "error" });
          return;
        }
        setState({ status: "empty" });
      });

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [assetId, refreshKey, scene.mockupCandidateId, scene.mockupLogoId]);

  const queueRender = async () => {
    if (!scene.mockupCandidateId) return;
    setActionError(null);
    setCopyFeedback(null);
    setQueueBusy(true);
    try {
      const run = await repo.queueAssetRun(
        scene.mockupCandidateId,
        assetId,
        requestDetails?.params,
      );
      setState({ status: run.status === "running" ? "running" : "queued", run });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "レンダーを開始できませんでした。",
      );
    } finally {
      setQueueBusy(false);
    }
  };

  const currentRun = "run" in state ? state.run : null;
  const hasManualOutput = state.status === "done" && !currentRun;
  const requestStatus = currentRun?.status ?? (hasManualOutput ? "processed" : "unprocessed");
  const canCreateRequest = Boolean(scene.mockupCandidateId) && !queueBusy;
  const canCopyRequest = Boolean(
    requestDetails && scene.mockupLogoId && scene.mockupCandidateId,
  );

  const copyRequest = async () => {
    if (!requestDetails || !scene.mockupLogoId || !scene.mockupCandidateId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        formatRenderRequest({
          run: currentRun,
          logoName: scene.name,
          logoId: scene.mockupLogoId,
          candidateId: scene.mockupCandidateId,
          assetId,
          label,
          requestDetails,
          hasManualOutput,
        }),
      );
      setCopyFeedback("依頼情報をコピーしました。");
    } catch {
      setCopyFeedback("コピーできませんでした。ブラウザの権限を確認してください。");
    }
  };

  return (
    <div className="min-w-0">
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-hairline bg-[#181817]"
        aria-busy={state.status === "loading"}
      >
        {state.status === "done" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.image}
            alt={`${scene.name}の${label}レンダー`}
            className="size-full object-cover"
          />
        ) : (
          <div className="px-6 text-center">
            <p className="font-mono text-[11px] uppercase text-white/55">
              {runtimeStateLabel(state.status)}
            </p>
            <p className="mt-2 text-sm text-pretty text-white/75">
              {state.status === "failed" && state.message
                ? state.message
                : scene.name}
            </p>
            {!requestDetails &&
            (state.status === "empty" ||
              state.status === "failed" ||
              state.status === "canceled") &&
            scene.mockupCandidateId ? (
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => void queueRender()}
                className="mt-4 border border-white/30 px-3 py-1.5 text-xs text-white transition-colors hover:border-white disabled:cursor-wait disabled:opacity-50"
              >
                {queueBusy ? "登録中..." : "レンダー依頼を作成"}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase text-ink-muted">{label}</p>
      {!requestDetails && actionError ? (
        <p aria-live="polite" className="mt-2 text-xs text-red-600">
          {actionError}
        </p>
      ) : null}
      {requestDetails ? (
        <section className="mt-5 border-t border-hairline pt-5">
          <p className="font-mono text-[11px] uppercase text-accent">
            Render request handoff
          </p>
          <dl className="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
            <dt className="text-ink-muted">Logo</dt>
            <dd className="min-w-0 text-pretty text-ink">{scene.name}</dd>
            <dt className="text-ink-muted">Logo ID</dt>
            <dd className="min-w-0 break-all font-mono text-xs text-ink">
              {scene.mockupLogoId ?? "正本ロゴを選択してください"}
            </dd>
            <dt className="text-ink-muted">Candidate ID</dt>
            <dd className="min-w-0 break-all font-mono text-xs text-ink">
              {scene.mockupCandidateId ?? "-"}
            </dd>
            <dt className="text-ink-muted">Asset</dt>
            <dd className="min-w-0 break-all font-mono text-xs text-ink">{assetId}</dd>
            <dt className="text-ink-muted">Version</dt>
            <dd className="font-mono text-xs tabular-nums text-ink">
              {requestDetails.version}
            </dd>
            <dt className="text-ink-muted">Run ID</dt>
            <dd className="min-w-0 break-all font-mono text-xs text-ink">
              {currentRun?.id ?? (hasManualOutput ? "未作成（手動登録）" : "依頼未作成")}
            </dd>
            <dt className="text-ink-muted">Status</dt>
            <dd className="font-mono text-xs text-ink">{requestStatus}</dd>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canCreateRequest}
              onClick={() => void queueRender()}
              className="border border-ink bg-ink px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-transparent hover:text-ink disabled:cursor-not-allowed disabled:border-hairline disabled:bg-ink/10 disabled:text-ink-faint"
            >
              {queueBusy
                ? "登録中..."
                : currentRun
                  ? "再レンダー依頼を作成"
                  : "レンダー依頼を作成"}
            </button>
            <button
              type="button"
              disabled={!canCopyRequest}
              onClick={() => void copyRequest()}
              className="border border-hairline px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              依頼情報をコピー
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-xs text-ink-muted">
            {copyFeedback ?? actionError ?? ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function runtimeStateLabel(status: RuntimeOutputState["status"] | AssetRunStatus) {
  switch (status) {
    case "loading":
      return "Checking output";
    case "unavailable":
      return "Select a canonical logo";
    case "empty":
      return "Unprocessed";
    case "queued":
      return "Queued";
    case "running":
      return "Rendering";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "succeeded":
      return "Processed";
    case "processed":
      return "Processed";
    case "error":
      return "Output unavailable";
    case "done":
      return "Rendered";
  }
}

function formatRenderRequest({
  run,
  logoName,
  logoId,
  candidateId,
  assetId,
  label,
  requestDetails,
  hasManualOutput,
}: {
  run: AssetRun | null;
  logoName: string;
  logoId: string;
  candidateId: string;
  assetId: string;
  label: string;
  requestDetails: RuntimeRequestDetails;
  hasManualOutput: boolean;
}) {
  return [
    `${label} レンダー依頼`,
    `Run ID: ${run?.id ?? (hasManualOutput ? "未作成（手動登録）" : "未作成（手動依頼）")}`,
    `Logo: ${logoName}`,
    `Logo ID: ${logoId}`,
    `Candidate ID: ${candidateId}`,
    `Asset Definition ID: ${assetId}`,
    `Asset Family: ${requestDetails.familyId}`,
    `Version: ${requestDetails.version}`,
    `Status: ${run?.status ?? (hasManualOutput ? "processed" : "unprocessed")}`,
    `Params: ${JSON.stringify(run?.params ?? requestDetails.params ?? {})}`,
    `Page: /labs/workflow/${assetId}`,
  ].join("\n");
}
