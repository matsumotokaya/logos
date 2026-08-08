"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CampaignDetail from "@/app/campaigns/[id]/CampaignDetail";
import { authedFetch } from "@/app/campaigns/campaign-ui";
import { refreshBrandTree } from "@/lib/brand-events";

interface LpDetail {
  id: string;
  brandId: string;
  title: string;
  serviceName: string;
  templateId: string;
  templateVersion: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  render: { id: string; status: string; updatedAt: string };
  artifact: {
    id: string;
    bytes: number;
    mediaType: string;
    createdAt: string;
  } | null;
  previewUrl: string | null;
  published: boolean;
  publicUrl: string | null;
  publishedAt: string | null;
  publicationHistoryCount: number;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "legacy" }
  | { kind: "error"; message: string }
  | { kind: "ready"; lp: LpDetail };

const formatDateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const formatBytes = (bytes: number): string =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(0, Math.round(bytes / 1_000))} KB`;

export default function BrandLpDetail({
  brandId,
  resourceId,
}: {
  brandId: string;
  resourceId: string;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await authedFetch(
        `/api/brands/${brandId}/lps/${resourceId}`,
      );
      if (response.status === 404) {
        setState({ kind: "legacy" });
        return;
      }
      const body = (await response.json().catch(() => null)) as
        | { lp?: LpDetail; error?: string }
        | null;
      if (!response.ok || !body?.lp) {
        throw new Error(body?.error ?? "LPを読み込めませんでした");
      }
      setState({ kind: "ready", lp: body.lp });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "LPを読み込めませんでした",
      });
    }
  }, [brandId, resourceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const setPublished = async (published: boolean) => {
    setSaving(true);
    setActionError(null);
    try {
      const response = await authedFetch(
        `/api/brands/${brandId}/lps/${resourceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "公開状態を変更できませんでした");
      }
      await load();
      refreshBrandTree();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "公開状態を変更できませんでした",
      );
    } finally {
      setSaving(false);
    }
  };

  if (state.kind === "legacy") {
    return (
      <CampaignDetail
        id={resourceId}
        sampleHtml={null}
        embedded
        view="lp"
        brandId={brandId}
      />
    );
  }

  if (state.kind === "loading") {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
        <div className="h-5 w-40 rounded bg-ink/10" />
        <div className="mt-4 h-10 w-80 max-w-full rounded bg-ink/10" />
        <div className="mt-8 h-[60dvh] min-h-96 rounded-2xl border border-hairline bg-ink/5" />
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-balance text-lg font-semibold">LPを開けませんでした</h1>
          <p className="mt-2 text-pretty text-sm text-red-700">{state.message}</p>
          <Link
            href={`/brands/${brandId}`}
            className="mt-5 inline-flex rounded-full border border-ink px-4 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ブランド詳細へ戻る
          </Link>
        </div>
      </main>
    );
  }

  const { lp } = state;
  const canPublish =
    lp.render.status === "ready" && Boolean(lp.artifact) && !saving;
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10">
      <nav
        aria-label="現在のブランド階層"
        className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
      >
        <Link href={`/brands/${brandId}`} className="hover:text-ink">
          ブランド
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">LP</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-5 border-b border-hairline pb-6">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-ink-muted">LANDING PAGE</p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                lp.published
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-ink/5 text-ink-muted"
              }`}
            >
              {lp.published ? "公開中" : "非公開"}
            </span>
          </div>
          <h1 className="mt-2 text-balance font-display text-3xl font-semibold">
            {lp.title}
          </h1>
          <p className="mt-3 text-pretty text-sm text-ink-muted">
            private previewと公開URLを、V2 Publicationの履歴を保ったまま管理します。
          </p>
          {actionError ? (
            <p className="mt-3 text-pretty text-sm text-red-700" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {lp.previewUrl ? (
            <a
              href={lp.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              private preview ↗
            </a>
          ) : null}
          {lp.published && lp.publicUrl ? (
            <a
              href={lp.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              公開ページ ↗
            </a>
          ) : null}
          <button
            type="button"
            disabled={lp.published ? saving : !canPublish}
            onClick={() => void setPublished(!lp.published)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "更新中…"
              : lp.published
                ? "公開を終了"
                : "公開する"}
          </button>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl border border-hairline">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-ink/5 px-4 py-3">
          <h2 className="text-balance text-sm font-semibold">LPプレビュー</h2>
          <span className="text-xs text-ink-muted">
            {lp.render.status === "ready" ? "Artifact準備済み" : `Render: ${lp.render.status}`}
          </span>
        </div>
        <div className="relative h-[70dvh] min-h-96 max-h-[800px] bg-white">
          {lp.previewUrl ? (
            <>
              <iframe
                title={`${lp.serviceName} — private LP preview`}
                src={lp.previewUrl}
                sandbox=""
                className="pointer-events-none h-full w-full"
              />
              <a
                href={lp.previewUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="private previewを新しいタブで開く"
                className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-sm font-semibold">プレビューはまだありません</p>
              <p className="mt-2 text-pretty text-xs text-ink-muted">
                Renderが完了すると、ここにprivate Artifactが表示されます。
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="テンプレート" value={`${lp.templateId}@${lp.templateVersion}`} />
        <Metric
          label="Artifact"
          value={lp.artifact ? formatBytes(lp.artifact.bytes) : "未生成"}
        />
        <Metric label="公開日時" value={formatDateTime(lp.publishedAt)} />
        <Metric label="公開履歴" value={`${lp.publicationHistoryCount}件`} />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold tabular-nums" title={value}>
        {value}
      </p>
    </div>
  );
}
