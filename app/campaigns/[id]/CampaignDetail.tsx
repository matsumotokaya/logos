"use client";

// /campaigns/[id] — one campaign's home. Left column: your campaign list
// (sample + generated) and the "new campaign" entry; right pane: the
// selected campaign expanded (digest + process log). A freshly started run
// lands here and the page follows it live: placeholders + floating log while
// running, real data when the job settles.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sampleCampaignKit, SAMPLE_CAMPAIGN_ID } from "@/lib/campaign/sample";
import type { CampaignBrandKit } from "@/lib/campaign/schema";
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
}: {
  id: string;
  sampleHtml: string | null;
}) {
  const isSample = id === SAMPLE_CAMPAIGN_ID;
  const [status, setStatus] = useState<Status>(isSample ? "done" : "loading");
  const [kit, setKit] = useState<CampaignBrandKit | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const applyPayload = useCallback((payload: JobPayload): "running" | "settled" => {
    const job = payload.job;
    if (!job) return "settled";
    setSteps(toStepEvents(job.steps));
    if (job.status === "done" && job.kit) {
      setKit(job.kit);
      setHtml(payload.html ?? null);
      setMeta(job.meta);
      setLpUrl(payload.lpUrl ?? null);
      setStatus("done");
      return "settled";
    }
    if (job.status === "error") {
      setError(job.error ?? "生成に失敗しました");
      setStatus("error");
      return "settled";
    }
    setStatus("running");
    return "running";
  }, []);

  // Sidebar campaign list — its own lifecycle, refreshed when the id changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // stay off the synchronous effect path
      if (!cancelled) await fetchJobs();
    })();
    return () => {
      cancelled = true;
    };
  }, [id, fetchJobs]);

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
  }, [id, isSample, applyPayload, fetchJobs, stopPolling]);

  const digestKit = isSample ? sampleCampaignKit : kit;
  const digestHtml = isSample ? sampleHtml : html;
  const digestLpUrl = isSample ? `/c/${SAMPLE_CAMPAIGN_ID}` : lpUrl;
  const working = status === "running" || status === "loading";

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:flex-row">
      {/* ---- left column: campaign list ---- */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="flex items-baseline justify-between lg:block">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Campaigns
          </h2>
          <Link
            href="/campaigns"
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

      {/* ---- right pane: the selected campaign ---- */}
      <div className="min-w-0 flex-1">
        {status === "missing" ? (
          <div className="rounded-2xl border border-hairline bg-paper p-8 text-center">
            <p className="text-sm font-semibold">キャンペーンが見つかりません</p>
            <p className="mt-2 text-[12px] text-ink-muted">
              {error ?? "URLが正しいか、ログイン中のアカウントを確認してください。"}
            </p>
            <Link
              href="/campaigns"
              className="mt-5 inline-block rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-paper hover:opacity-85"
            >
              Campaigns トップへ
            </Link>
          </div>
        ) : (
          <>
            {status === "running" && (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-hairline bg-ink/5 px-4 py-2.5 text-[12px] text-ink-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
                生成中（2〜4分）— ページを閉じても処理は継続し、ここに結果が入ります
              </p>
            )}
            {status === "error" && error && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
                {error} — <Link href="/campaigns" className="underline">別のソースで作り直す</Link>
              </p>
            )}
            <ResultDigest
              kit={digestKit}
              html={digestHtml}
              meta={isSample ? null : meta}
              lpUrl={digestLpUrl}
              sample={isSample}
              working={working}
            />
            {!isSample && status !== "running" && steps.length > 0 && (
              <ProcessLog steps={steps} working={false} />
            )}
          </>
        )}
      </div>

      {status === "running" && steps.length > 0 && <ProcessLogPopup steps={steps} />}
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
          )
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        <span className="block truncate text-[10px] text-ink-faint">{note}</span>
      </span>
    </Link>
  );
}
