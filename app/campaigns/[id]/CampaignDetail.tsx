"use client";

// /campaigns/[id] — one campaign's home. Left column: your campaign list
// (sample + generated) and the "new campaign" entry; right pane: the
// selected campaign expanded (digest + process log). A freshly started run
// lands here and the page follows it live: placeholders + floating log while
// running, real data when the job settles.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { refreshBrandTree } from "@/lib/brand-events";
import { sampleCampaignKit, SAMPLE_CAMPAIGN_ID } from "@/lib/campaign/sample";
import type { CampaignBrandKit, CampaignPartial } from "@/lib/campaign/schema";
import type { CampaignCmState } from "@/lib/campaign/cm-types";
import type { UrlRegistrationScope } from "@/lib/brand-registration";
import {
  POLL_INTERVAL_MS,
  ProcessLog,
  ProcessLogPopup,
  ResultDigest,
  authedFetch,
  formatDate,
  toStepEvents,
  type GenerateMeta,
  type JobPayload,
  type JobSummary,
  type StepEvent,
} from "../campaign-ui";

type Status = "loading" | "running" | "done" | "error" | "missing";

export default function CampaignDetail({
  id,
  sampleHtml,
  autoGenerateCm,
  embedded = false,
  view = "catalog",
  brandId = null,
}: {
  id: string;
  sampleHtml: string | null;
  autoGenerateCm: boolean;
  embedded?: boolean;
  view?: "catalog" | "lp" | "video";
  brandId?: string | null;
}) {
  const router = useRouter();
  const isSample = id === SAMPLE_CAMPAIGN_ID;
  const [status, setStatus] = useState<Status>(isSample ? "done" : "loading");
  const [kit, setKit] = useState<CampaignBrandKit | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [partial, setPartial] = useState<CampaignPartial | null>(null);
  const [cm, setCm] = useState<CampaignCmState | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [registrationScope, setRegistrationScope] =
    useState<UrlRegistrationScope>("business");
  const [catalogOrganizationId, setCatalogOrganizationId] = useState<
    string | null
  >(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [downloadWhenReady, setDownloadWhenReady] = useState(false);
  // Bumped to restart polling after an action kicks a new server-side run
  // (e.g. the CM voice generation) on an already-settled job.
  const [pollEpoch, setPollEpoch] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoGenerateHandled = useRef(false);
  const trackGeneratedAt = useRef<string | null>(null);
  const catalogTreeVersion = useRef<string | null>(null);
  const catalogRecovery = useRef<{
    jobId: string;
    state: "running" | "complete" | "failed";
  } | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await authedFetch("/api/labs/campaign/jobs?list=1");
      if (!res.ok) return;
      const json = (await res.json()) as { jobs?: JobSummary[] };
      setJobs(json.jobs ?? []);
    } catch {
      setJobs([]);
    }
  }, []);

  const applyPayload = useCallback(
    (payload: JobPayload): "running" | "settled" => {
      const job = payload.job;
      if (!job) return "settled";
      setSteps(toStepEvents(job.steps));
      setPartial(job.partial ?? null);
      setRegistrationScope(job.input?.registrationScope ?? "business");
      setCatalogOrganizationId(job.catalog?.organizationId ?? null);
      setCatalogError(job.catalogError ?? null);
      const nextCatalogTreeVersion = job.catalog
        ? `${job.catalog.organizationId}:${job.catalog.businessId}:${job.catalog.campaignId}:${job.catalog.syncedAt}`
        : null;
      if (
        nextCatalogTreeVersion &&
        nextCatalogTreeVersion !== catalogTreeVersion.current
      ) {
        catalogTreeVersion.current = nextCatalogTreeVersion;
        refreshBrandTree();
      }
      const nextTrackGeneratedAt = job.cm?.track?.generatedAt ?? null;
      setCm((current) => {
        if (
          current?.track &&
          job.cm?.track &&
          current.track.generatedAt === job.cm.track.generatedAt
        ) {
          return { ...job.cm, track: current.track };
        }
        return job.cm ?? null;
      });
      if (nextTrackGeneratedAt !== trackGeneratedAt.current) {
        trackGeneratedAt.current = nextTrackGeneratedAt;
        setAudioUrl(payload.audioUrl ?? null);
      }
      setVideoUrl(payload.videoUrl ?? null);
      // Draft kit: published after the creative stage while verify still runs —
      // the digest fills completely, polling continues for the final result.
      if (job.status === "running" && job.kit) {
        setKit(job.kit);
        setHtml(payload.html ?? null);
      }
      if (job.status === "done" && job.kit) {
        setKit(job.kit);
        setHtml(payload.html ?? null);
        setMeta(job.meta);
        setLpUrl(payload.lpUrl ?? null);
        setStatus("done");
        // The creative job settles just before its Organization/business
        // records finish saving. Poll through that short persistence window.
        if (!job.catalog) {
          if (!job.catalogError) return "running";

          let recovery = catalogRecovery.current;
          if (!recovery || recovery.jobId !== job.id) {
            const nextRecovery: NonNullable<typeof catalogRecovery.current> = {
              jobId: job.id,
              state: "running",
            };
            recovery = nextRecovery;
            catalogRecovery.current = nextRecovery;
            void authedFetch("/api/brands/backfill", { method: "POST" })
              .then((response) => {
                nextRecovery.state = response.ok ? "complete" : "failed";
              })
              .catch(() => {
                nextRecovery.state = "failed";
              });
            return "running";
          }
          if (recovery.state === "running") return "running";
          if (recovery.state === "failed") return "settled";
          // This payload was fetched after recovery completed. If the catalog
          // is still absent, keep the existing error visible instead of
          // polling forever.
          return "settled";
        }
        // A CM voice run keeps the poll alive after the main job settled.
        return job.cm?.status === "running" ? "running" : "settled";
      }
      if (job.status === "error") {
        setError(job.error ?? "生成に失敗しました");
        setStatus("error");
        return "settled";
      }
      setStatus("running");
      return "running";
    },
    [],
  );

  // Sidebar campaign list — its own lifecycle, refreshed when the id changes.
  useEffect(() => {
    if (embedded) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // stay off the synchronous effect path
      if (!cancelled) await fetchJobs();
    })();
    return () => {
      cancelled = true;
    };
  }, [embedded, id, fetchJobs]);

  useEffect(() => {
    if (isSample) return;

    let cancelled = false;
    let loadedOnce = false;
    const tick = async (): Promise<"running" | "settled" | "retry"> => {
      try {
        const res = await authedFetch(`/api/labs/campaign/jobs?id=${id}`);
        if (res.status === 404) {
          if (!cancelled) setStatus("missing");
          return "settled";
        }
        if (!res.ok) return "retry"; // transient — keep polling
        loadedOnce = true;
        const state = applyPayload((await res.json()) as JobPayload);
        if (state === "settled") void fetchJobs(); // refresh sidebar names
        return state;
      } catch (e) {
        if (!cancelled && !loadedOnce) {
          setError(e instanceof Error ? e.message : "読み込みに失敗しました");
          setStatus("missing");
          return "settled";
        }
        return "retry"; // network hiccup mid-run: the job keeps going server-side
      }
    };

    (async () => {
      const first = await tick();
      if (cancelled || first !== "running") return;
      pollTimer.current = setInterval(async () => {
        const state = await tick();
        if (state !== "running" && state !== "retry") stopPolling();
      }, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [id, isSample, applyPayload, fetchJobs, stopPolling, pollEpoch]);

  // Kick the CM voice run (TTS) and follow it with the regular job polling.
  const generateCm = useCallback(async () => {
    try {
      setCm({ status: "running", error: null, track: null });
      const res = await authedFetch("/api/labs/campaign/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error ?? "音声生成を開始できませんでした");
      }
      setPollEpoch((n) => n + 1);
    } catch (e) {
      setCm({
        status: "error",
        error: e instanceof Error ? e.message : "音声生成に失敗しました",
        track: null,
      });
    }
  }, [id]);

  const generateMp4 = useCallback(async () => {
    try {
      setDownloadWhenReady(true);
      setCm((current) =>
        current ? { ...current, status: "running", error: null } : current,
      );
      const res = await authedFetch(`/api/labs/campaign/video/${id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          json?.error ?? "MP4ファイルの作成を開始できませんでした",
        );
      }
      setPollEpoch((n) => n + 1);
    } catch (e) {
      setDownloadWhenReady(false);
      setCm((current) =>
        current
          ? {
              ...current,
              status: "error",
              error:
                e instanceof Error
                  ? e.message
                  : "MP4ファイルを作成できませんでした",
            }
          : current,
      );
    }
  }, [id]);

  useEffect(() => {
    if (!downloadWhenReady || !videoUrl) return;
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = "campaign-cm.mp4";
    link.click();
    setDownloadWhenReady(false);
  }, [downloadWhenReady, videoUrl]);

  // The LP's empty video slot links back with a one-shot intent. Starting the
  // run here keeps authentication and ownership checks identical to the
  // detail-page button instead of exposing a paid endpoint from public HTML.
  useEffect(() => {
    if (
      !autoGenerateCm ||
      isSample ||
      status !== "done" ||
      autoGenerateHandled.current
    ) {
      return;
    }

    let cancelled = false;
    autoGenerateHandled.current = true;
    const cleanPath = brandId
      ? view === "video"
        ? `/brands/${brandId}/video/${id}`
        : `/brands/${brandId}/lp/${id}`
      : view === "video"
        ? `/campaigns/${id}/video`
        : `/campaigns/${id}`;
    router.replace(cleanPath, { scroll: false });
    if (cm?.status !== "running" && !cm?.track && !videoUrl) {
      void Promise.resolve().then(() => {
        if (!cancelled) void generateCm();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    autoGenerateCm,
    brandId,
    cm,
    generateCm,
    id,
    isSample,
    router,
    status,
    videoUrl,
    view,
  ]);

  const digestKit = isSample ? sampleCampaignKit : kit;
  const digestHtml = isSample ? sampleHtml : html;
  const digestLpUrl = isSample ? `/c/${SAMPLE_CAMPAIGN_ID}` : lpUrl;
  const working = status === "running" || status === "loading";

  return (
    <main
      className={cn(
        "mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:px-10",
        !embedded && "lg:flex-row",
      )}
    >
      {/* ---- left column: campaign list ---- */}
      {!embedded ? (
        <aside className="w-full shrink-0 lg:w-64">
          <div className="flex items-baseline justify-between lg:block">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
              Campaigns
            </h2>
            <Link
              href="/"
              className="mt-0 block rounded-xl border border-dashed border-ink-faint px-4 py-2.5 text-center text-[12px] font-semibold text-ink-muted transition hover:border-ink hover:text-ink lg:mt-3"
            >
              ＋ 新しいキャンペーン
            </Link>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            <SidebarItem
              href={`/campaigns/${SAMPLE_CAMPAIGN_ID}`}
              active={isSample}
              primary={sampleCampaignKit.brand.primary}
              accent={sampleCampaignKit.brand.accent}
              name={sampleCampaignKit.service.name}
              note="サンプル"
            />
            {(jobs ?? []).map((j) => (
              <SidebarItem
                key={j.id}
                href={`/campaigns/${j.id}`}
                active={j.id === id}
                primary={j.primary}
                accent={j.accent}
                name={j.name}
                note={
                  j.status === "running"
                    ? "生成中…"
                    : j.status === "error"
                      ? "エラー"
                      : formatDate(j.createdAt)
                }
              />
            ))}
          </nav>
        </aside>
      ) : null}

      {/* ---- right pane: the selected campaign ---- */}
      <div className="min-w-0 flex-1">
        {status === "missing" ? (
          <div className="rounded-2xl border border-hairline bg-paper p-8 text-center">
            <p className="text-sm font-semibold">
              キャンペーンが見つかりません
            </p>
            <p className="mt-2 text-[12px] text-ink-muted">
              {error ??
                "URLが正しいか、ログイン中のアカウントを確認してください。"}
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-paper hover:opacity-85"
            >
              Campaigns トップへ
            </Link>
          </div>
        ) : (
          <>
            {digestKit ? (
              <nav
                aria-label="現在のブランド階層"
                className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted"
              >
                <Link
                  href={
                    brandId
                      ? `/brands/${brandId}`
                      : catalogOrganizationId
                      ? `/organizations/${catalogOrganizationId}`
                      : "/brands"
                  }
                  className="hover:text-ink"
                >
                  {registrationScope === "organization"
                    ? digestKit.service.name
                    : (digestKit.organization?.name ??
                      (registrationScope === "both"
                        ? digestKit.service.name
                        : "運営組織（未確認）"))}
                </Link>
                <span aria-hidden className="text-ink-faint">
                  /
                </span>
                <span className="font-semibold text-ink">
                  {digestKit.service.name}
                </span>
                <span aria-hidden className="text-ink-faint">
                  /
                </span>
                {view === "catalog" ? (
                  <span>生成アセット</span>
                ) : (
                  <>
                    <Link
                      href={brandId ? `/brands/${brandId}` : `/campaigns/${id}`}
                      className="hover:text-ink"
                    >
                      ブランド
                    </Link>
                    <span aria-hidden className="text-ink-faint">
                      /
                    </span>
                    <span>{view === "lp" ? "LP" : "動画"}</span>
                  </>
                )}
              </nav>
            ) : null}
            {view !== "catalog" ? (
              <header className="mb-6 flex flex-wrap items-start justify-between gap-5 border-b border-hairline pb-6">
                <div className="min-w-0 max-w-3xl">
                  <p className="text-xs font-semibold text-ink-muted">
                    {view === "lp" ? "LANDING PAGE" : "VIDEO"}
                  </p>
                  <h1 className="mt-2 text-balance font-display text-3xl font-semibold">
                    {digestKit?.service.name
                      ? `${digestKit.service.name}の${view === "lp" ? "LP" : "動画"}`
                      : view === "lp"
                        ? "LP"
                        : "動画"}
                  </h1>
                  <p className="mt-3 text-pretty text-sm text-ink-muted">
                    {view === "lp"
                      ? "生成されたセールスページのプレビューと公開先を管理します。"
                      : "製品紹介動画、ナレーション、MP4の作成とダウンロードを管理します。"}
                  </p>
                </div>
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label="ブランドアセット"
                >
                  <Link
                    href={brandId ? `/brands/${brandId}` : `/campaigns/${id}`}
                    className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    ブランド詳細
                  </Link>
                  <Link
                    href={
                      brandId
                        ? `/brands/${brandId}/${view === "lp" ? "video" : "lp"}/${id}`
                        : `/campaigns/${id}/${view === "lp" ? "video" : "lp"}`
                    }
                    className="rounded-full border border-ink px-4 py-2 text-xs font-semibold hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {view === "lp" ? "動画を見る" : "LPを見る"}
                  </Link>
                </nav>
              </header>
            ) : null}
            {status === "done" && catalogError && !catalogOrganizationId ? (
              <p
                className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800"
                role="status"
              >
                LPは完成していますが、事業情報の登録を完了できませんでした。時間をおいて再度お試しください。
              </p>
            ) : null}
            {status === "running" && (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-hairline bg-ink/5 px-4 py-2.5 text-[12px] text-ink-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
                生成中（2〜4分）—
                ページを閉じても処理は継続し、ここに結果が入ります
              </p>
            )}
            {status === "error" && error && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
                {error} —{" "}
                <Link href="/" className="underline">
                  別のソースで作り直す
                </Link>
              </p>
            )}
            <ResultDigest
              kit={digestKit}
              html={digestHtml}
              meta={isSample ? null : meta}
              lpUrl={digestLpUrl}
              sample={isSample}
              working={working}
              partial={isSample ? null : partial}
              cm={isSample ? null : cm}
              audioUrl={isSample ? null : audioUrl}
              videoUrl={isSample ? null : videoUrl}
              onGenerateCm={
                isSample || status !== "done" ? undefined : generateCm
              }
              onGenerateMp4={
                isSample || status !== "done" || !cm?.track
                  ? undefined
                  : generateMp4
              }
              view={view}
            />
            {view === "catalog" &&
              !isSample &&
              status !== "running" &&
              steps.length > 0 && (
                <ProcessLog steps={steps} working={cm?.status === "running"} />
              )}
          </>
        )}
      </div>

      {(status === "running" || cm?.status === "running") &&
        steps.length > 0 && <ProcessLogPopup steps={steps} />}
    </main>
  );
}

function SidebarItem({
  href,
  active,
  primary,
  accent,
  name,
  note,
}: {
  href: string;
  active: boolean;
  primary: string | null;
  accent: string | null;
  name: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex w-56 shrink-0 items-center gap-3 rounded-xl border px-3.5 py-3 transition lg:w-auto ${
        active ? "border-ink bg-ink/5" : "border-hairline hover:border-ink"
      }`}
    >
      <span className="flex shrink-0 gap-1">
        {[primary, accent].map((hex, i) =>
          hex ? (
            <span
              key={i}
              className="h-3.5 w-3.5 rounded-full border border-hairline"
              style={{ backgroundColor: hex }}
            />
          ) : (
            <span key={i} className="h-3.5 w-3.5 rounded-full bg-ink/10" />
          ),
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        <span className="block truncate text-[10px] text-ink-faint">
          {note}
        </span>
      </span>
    </Link>
  );
}
