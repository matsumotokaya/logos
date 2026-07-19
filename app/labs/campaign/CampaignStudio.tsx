"use client";

// Campaign Studio — NotebookLM-style intake on top of the campaign pipeline.
// Add any mix of sources (URL / PDF / images / pasted text), press generate,
// and get the marketing asset digest in one shot: Service Brand Kit summary,
// LP hero preview (click through to the real page) and the promo-video slot.
//
// Generation runs as a detached server-side job: this component only polls
// the job store, so closing the tab or losing the connection never loses a
// run — on reload the latest job (log history included) is restored.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CampaignBrandKit } from "@/lib/campaign/schema";

type UiFile = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  mediaType: string;
  data: string; // base64, no data: prefix
};

type Phase = "idle" | "working" | "done" | "error";

type GenerateMeta = {
  captured: boolean;
  adjudicated: boolean;
  verification: {
    verdict: "pass" | "palette_mismatch" | "tone_mismatch";
    reason: string;
    retried: boolean;
  } | null;
  usage?: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  } | null;
};

type StepLevel = "info" | "success" | "warn";
type StepEvent = { id: number; ts: string; message: string; level: StepLevel };

type JobPayload = {
  job: {
    id: string;
    status: "running" | "done" | "error";
    createdAt: string;
    steps: { ts: string; message: string; level: StepLevel }[];
    kit: CampaignBrandKit | null;
    meta: GenerateMeta | null;
    error: string | null;
  } | null;
  html?: string | null;
  lpUrl?: string | null;
};

const SAMPLES: { label: string; url: string }[] = [
  { label: "Anthropic", url: "https://www.anthropic.com" },
  { label: "Apple", url: "https://www.apple.com/jp/" },
  { label: "Google", url: "https://about.google/" },
];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  saas: "SaaS",
  app: "アプリ",
  web_service: "Webサービス",
  ecommerce: "EC",
  media: "メディア",
  consulting: "コンサルティング",
  agency: "制作・代理店",
  restaurant: "飲食",
  retail: "小売",
  local_service: "サービス業（実店舗）",
  freelance: "フリーランス・個人",
  community: "コミュニティ",
  tool: "ツール",
  other: "その他",
};

const POLL_INTERVAL_MS = 2500;

const ACCEPTED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

async function fileToUiFile(file: File): Promise<UiFile | null> {
  if (!ACCEPTED.has(file.type)) return null;
  if (file.size > 4_500_000) return null;
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    id: `${file.name}-${file.size}-${Date.now()}`,
    name: file.name,
    kind: file.type === "application/pdf" ? "pdf" : "image",
    mediaType: file.type,
    data: btoa(binary),
  };
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です（Labsアクセス権のあるアカウント）");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

const stepTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", { hour12: false });

export default function CampaignStudio() {
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [files, setFiles] = useState<UiFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<CampaignBrandKit | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [meta, setMeta] = useState<GenerateMeta | null>(null);
  const [lpUrl, setLpUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSource = url.trim() !== "" || files.length > 0 || pastedText.trim() !== "";

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const added: UiFile[] = [];
    for (const f of Array.from(list)) {
      const ui = await fileToUiFile(f);
      if (ui) added.push(ui);
    }
    if (added.length)
      setFiles((prev) => [...prev, ...added].slice(0, 5));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const applyJobPayload = useCallback(
    (payload: JobPayload): "running" | "settled" | "none" => {
      const job = payload.job;
      if (!job) return "none";
      setSteps(
        job.steps.map((s, i) => ({
          id: i,
          ts: stepTime(s.ts),
          message: s.message,
          level: s.level,
        }))
      );
      if (job.status === "done" && job.kit) {
        setKit(job.kit);
        setHtml(payload.html ?? null);
        setMeta(job.meta);
        setLpUrl(payload.lpUrl ?? null);
        setPhase("done");
        return "settled";
      }
      if (job.status === "error") {
        setError(job.error ?? "生成に失敗しました");
        setPhase("error");
        return "settled";
      }
      setPhase("working");
      return "running";
    },
    []
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const res = await authedFetch(`/api/labs/campaign/jobs?id=${jobId}`);
          if (!res.ok) return; // transient — keep polling
          const state = applyJobPayload((await res.json()) as JobPayload);
          if (state !== "running") stopPolling();
        } catch {
          // network hiccup: the job keeps running server-side, just retry
        }
      };
      void tick();
      pollTimer.current = setInterval(() => void tick(), POLL_INTERVAL_MS);
    },
    [applyJobPayload, stopPolling]
  );

  // Reload / reconnect recovery: restore the latest job (log + result).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch("/api/labs/campaign/jobs");
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as JobPayload;
        if (cancelled) return;
        const state = applyJobPayload(payload);
        if (state === "running" && payload.job) startPolling(payload.job.id);
      } catch {
        // signed out or labs-gated: stay idle
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [applyJobPayload, startPolling, stopPolling]);

  const generate = async () => {
    setError(null);
    setSteps([]);
    setKit(null);
    setHtml(null);
    setMeta(null);
    setLpUrl(null);
    setPhase("working");
    try {
      const res = await authedFetch("/api/labs/campaign/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || undefined,
          pastedText: pastedText.trim() || undefined,
          files: files.map((f) => ({
            kind: f.kind,
            mediaType: f.mediaType,
            data: f.data,
          })),
        }),
      });
      const json = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !json.jobId) {
        throw new Error(json.error ?? `生成を開始できませんでした (HTTP ${res.status})`);
      }
      startPolling(json.jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setKit(null);
    setHtml(null);
    setMeta(null);
    setLpUrl(null);
    setError(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Campaign Lab — 統合表現研究所
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          ソースを追加するだけで、紹介LPと動画を。
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          URL・PDF・スクリーンショット・テキスト。サービスの内容がわかるものを渡すと、
          ブランドを理解した Service Brand Kit を生成し、LP・紹介動画などの
          マーケティングアセットが一式で出てきます。生成はサーバー側で走るので、
          ページを閉じても次に開いたときに結果が復元されます。
        </p>
      </header>

      {(phase === "idle" || phase === "error" || phase === "working") && (
        <section className="mt-8 rounded-2xl border border-hairline bg-paper p-6 shadow-sm md:p-8">
          <h2 className="text-sm font-semibold">ソースを追加</h2>

          {/* URL row + samples */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-service.example.com"
              className="w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-ink"
              disabled={phase === "working"}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-muted">試しに:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => setUrl(s.url)}
                className="rounded-full border border-hairline px-3 py-1 text-[11px] text-ink-muted transition hover:border-ink hover:text-ink"
                disabled={phase === "working"}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-5 cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
              dragOver ? "border-ink bg-ink/5" : "border-hairline hover:border-ink-faint"
            }`}
          >
            <p className="text-sm text-ink-muted">
              PDF・画像をドロップ、またはクリックして選択
            </p>
            <p className="mt-1 text-[11px] text-ink-faint">
              チラシ / 企画書 / スクリーンショット など、サービスがわかるもの（5個・各4.5MBまで）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[11px]"
                >
                  <span>{f.kind === "pdf" ? "📄" : "🖼"}</span>
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`${f.name} を削除`}
                    onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                    className="text-ink-faint hover:text-ink"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Paste text */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowPaste((v) => !v)}
              className="text-[12px] text-ink-muted underline-offset-2 hover:underline"
            >
              {showPaste ? "テキスト貼り付けを閉じる" : "コピーしたテキストを貼り付ける"}
            </button>
            {showPaste && (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={5}
                placeholder="サービス概要・プレスリリース・紹介文などを貼り付け"
                className="mt-2 w-full rounded-xl border border-hairline bg-paper px-4 py-3 text-sm outline-none placeholder:text-ink-faint focus:border-ink"
                disabled={phase === "working"}
              />
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!hasSource || phase === "working"}
              className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-paper transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === "working" ? "生成中…" : "LPと動画素材を生成"}
            </button>
            {phase === "working" && (
              <span className="flex items-center gap-2 text-[12px] text-ink-muted">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
                {steps.length > 0 ? steps[steps.length - 1].message : "開始しています…"}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Result layout is always visible: placeholders first (so you can
          predict what you'll get), then filled in when the job completes. */}
      <ResultDigest
        kit={kit}
        html={html}
        meta={meta}
        lpUrl={lpUrl}
        onReset={phase === "done" ? reset : null}
        working={phase === "working"}
      />

      {/* While running: the log floats as a popup. When finished it
          auto-dismisses and reappears below the assets as reference info. */}
      {phase === "working" && steps.length > 0 && <ProcessLogPopup steps={steps} />}
      {phase !== "working" && steps.length > 0 && (
        <ProcessLog steps={steps} working={false} />
      )}
    </main>
  );
}

const LOG_MARKS: Record<StepLevel, { icon: string; cls: string }> = {
  info: { icon: "·", cls: "text-ink-faint" },
  success: { icon: "✓", cls: "text-emerald-600" },
  warn: { icon: "⚠", cls: "text-amber-600" },
};

function ProcessLogLines({ steps, working }: { steps: StepEvent[]; working: boolean }) {
  return (
    <ol className="space-y-1.5 font-mono text-[11px] leading-relaxed">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-2">
          <span className="shrink-0 text-ink-faint">{s.ts}</span>
          <span className={`w-3 shrink-0 text-center ${LOG_MARKS[s.level].cls}`}>
            {LOG_MARKS[s.level].icon}
          </span>
          <span className={s.level === "warn" ? "text-amber-700" : undefined}>
            {s.message}
          </span>
        </li>
      ))}
      {working && (
        <li className="flex items-center gap-2 text-ink-muted">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          <span>…</span>
        </li>
      )}
    </ol>
  );
}

// While the job runs, the log floats as a popup window over the placeholder
// layout — the agentic process is visible without occupying the page. It
// disappears automatically when the run settles.
function ProcessLogPopup({ steps }: { steps: StepEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [steps]);
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(440px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-hairline bg-paper shadow-2xl">
      <div className="flex items-center justify-between border-b border-hairline bg-ink/5 px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
          処理ログ — 実行中
        </span>
        <span className="text-[10px] text-ink-muted">ページを閉じても継続します</span>
      </div>
      <div ref={scrollRef} className="max-h-[40vh] overflow-y-auto p-4">
        <ProcessLogLines steps={steps} working />
      </div>
    </div>
  );
}

// After the run, the same log sits below the marketing assets as reference
// info — you can still see whether capture ran or was skipped (⚠).
function ProcessLog({ steps, working }: { steps: StepEvent[]; working: boolean }) {
  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-paper p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">処理ログ</h2>
        <span className="text-[11px] text-ink-muted">この実行の参考情報</span>
      </div>
      <div className="mt-3">
        <ProcessLogLines steps={steps} working={working} />
      </div>
    </section>
  );
}

// Grey placeholder bar. Pulsing while a run is in progress is driven by the
// parent section's `[&_.ph]:animate-pulse` variant class.
function Ph({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`ph inline-block rounded bg-ink/10 ${className}`} />;
}

// Result digest. Always rendered — placeholders first, so the user can see
// from the start what a run will produce; filled in when the job completes.
// Structure follows the information hierarchy:
//   1. Service header — what this business IS (analysis of the sources)
//   2. Marketing assets — what was generated FROM it:
//      Service Brand Kit (design), sales page (LP), promo video (+ narration)
function ResultDigest({
  kit,
  html,
  meta,
  lpUrl,
  onReset,
  working,
}: {
  kit: CampaignBrandKit | null;
  html: string | null;
  meta: GenerateMeta | null;
  lpUrl: string | null;
  onReset: (() => void) | null;
  working: boolean;
}) {
  const swatches = kit
    ? [
        { label: "Primary", hex: kit.brand.primary },
        { label: "Accent", hex: kit.brand.accent },
        { label: "BG", hex: kit.brand.background },
        { label: "Surface", hex: kit.brand.surface },
        { label: "Text", hex: kit.brand.text },
      ]
    : [
        { label: "Primary", hex: null },
        { label: "Accent", hex: null },
        { label: "BG", hex: null },
        { label: "Surface", hex: null },
        { label: "Text", hex: null },
      ];

  const tokens: { label: string; value: string | null }[] = kit?.design_tokens
    ? [
        { label: "本文フォント", value: kit.design_tokens.body_font },
        { label: "見出しフォント", value: kit.design_tokens.heading_font },
        { label: "ボタン角丸", value: kit.design_tokens.button_radius },
        { label: "ボタン余白", value: kit.design_tokens.button_padding },
        { label: "セクション余白", value: kit.design_tokens.section_spacing },
        { label: "コンテンツ幅", value: kit.design_tokens.container_width },
      ].filter((t) => t.value)
    : [];

  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openLp = () => {
    if (lpUrl) {
      window.open(lpUrl, "_blank");
    } else if (html) {
      const blob = new Blob([html], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    }
  };

  return (
    <section className={`mt-8 ${working ? "[&_.ph]:animate-pulse" : ""}`}>
      {/* ---- Service header: the analysis, one level above the assets ---- */}
      <div className="rounded-2xl border border-hairline bg-paper p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {kit ? (
              <>
                <p className="font-display text-2xl font-semibold">{kit.service.name}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{kit.service.tagline}</p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-semibold text-ink-faint">
                  サービス分析
                </p>
                <p className="mt-1 text-[13px] text-ink-faint">
                  ソースから読み取ったサービスの実像がここに入ります
                </p>
              </>
            )}
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="shrink-0 text-[11px] text-ink-muted underline-offset-2 hover:underline"
            >
              別のソースで作り直す
            </button>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[12px] sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-ink-faint">業種</dt>
          <dd>{kit ? kit.service.industry : <Ph className="h-3.5 w-28" />}</dd>
          <dt className="text-ink-faint">事業タイプ</dt>
          <dd>
            {kit ? (
              (BUSINESS_TYPE_LABELS[kit.service.business_type] ?? kit.service.business_type)
            ) : (
              <Ph className="h-3.5 w-20" />
            )}
          </dd>
          <dt className="text-ink-faint">提供価値</dt>
          <dd className="sm:col-span-3">
            {kit ? kit.service.offering : <Ph className="h-3.5 w-full max-w-md" />}
          </dd>
          <dt className="text-ink-faint">ターゲット</dt>
          <dd className="sm:col-span-3">
            {kit ? kit.service.audience : <Ph className="h-3.5 w-56" />}
          </dd>
          <dt className="text-ink-faint">概要</dt>
          <dd className="sm:col-span-3">
            {kit ? kit.service.description : <Ph className="h-3.5 w-full max-w-lg" />}
          </dd>
        </dl>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">マーケティングアセット</h2>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* ---- Service Brand Kit: the design system ---- */}
        <div className="rounded-2xl border border-hairline p-6">
          <h3 className="text-sm font-semibold">Service Brand Kit</h3>
          <p className="mt-1 text-[11px] text-ink-muted">
            ロゴ・カラー・タイポグラフィなど、全アセット共通のデザイン基盤
          </p>

          <div className="mt-4">
            <p className="text-[11px] font-semibold text-ink-muted">ロゴ</p>
            {kit?.assets?.logo ? (
              <div className="mt-2 inline-block rounded-xl border border-hairline bg-white p-3">
                {/* base64 data URI from our own capture — next/image not applicable */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${kit.assets.logo.media_type};base64,${kit.assets.logo.data}`}
                  alt={`${kit.service.name} のロゴ`}
                  className="h-10 w-auto max-w-[200px] object-contain"
                />
              </div>
            ) : kit ? (
              <p className="mt-2 text-[12px] text-ink-muted">
                取得できず — ワードマーク（タイポグラフィ）で代替
              </p>
            ) : (
              <div className="mt-2 flex h-16 w-44 items-center justify-center rounded-xl border border-dashed border-hairline text-[11px] text-ink-faint">
                サイトから取得
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold text-ink-muted">カラーパレット</p>
            <div className="mt-2 flex gap-2">
              {swatches.map((s) => (
                <div key={s.label} className="text-center">
                  <div
                    className={`h-9 w-9 rounded-lg border border-hairline ${
                      s.hex ? "" : `bg-ink/5 ${working ? "animate-pulse" : ""}`
                    }`}
                    style={s.hex ? { backgroundColor: s.hex } : undefined}
                    title={s.hex ? `${s.label} ${s.hex}` : s.label}
                  />
                  <p className="mt-1 text-[9px] text-ink-faint">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {kit ? (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    kit.brand.palette_source === "extracted"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                  title={
                    kit.brand.palette_source === "extracted"
                      ? "実際のサイトをレンダリングして収集した証拠から選ばれたパレット"
                      : "サイトの証拠が取れなかったため、AIが提案したパレット"
                  }
                >
                  {kit.brand.palette_source === "extracted" ? "サイトから抽出" : "AI提案"}
                </span>
              ) : (
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[10px] text-ink-faint">
                  実サイトの証拠から抽出（取れなければAI提案と明示）
                </span>
              )}
              {kit && meta?.verification && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    meta.verification.verdict === "pass"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                  title={meta.verification.reason}
                >
                  {meta.verification.verdict === "pass"
                    ? `元サイトと照合済み${meta.verification.retried ? "（1回再生成）" : ""}`
                    : `検証: ${meta.verification.verdict}`}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-semibold text-ink-muted">
              デザイントークン（CSSからの推定）
            </p>
            {tokens.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
                {tokens.map((t) => (
                  <div key={t.label} className="contents">
                    <dt className="text-ink-faint">{t.label}</dt>
                    <dd>{t.value}</dd>
                  </div>
                ))}
              </dl>
            ) : kit ? (
              <p className="mt-2 text-[12px] text-ink-muted">取得できず</p>
            ) : (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
                {["本文フォント", "見出しフォント", "ボタン角丸", "セクション余白"].map(
                  (label) => (
                    <div key={label} className="contents">
                      <dt className="text-ink-faint">{label}</dt>
                      <dd>
                        <Ph className="h-3 w-24" />
                      </dd>
                    </div>
                  )
                )}
              </dl>
            )}
          </div>

          <div className="mt-5">
            <button
              type="button"
              disabled={!kit}
              onClick={() =>
                kit &&
                download("brandkit.json", JSON.stringify(kit, null, 2), "application/json")
              }
              className="rounded-full border border-hairline px-4 py-1.5 text-[12px] hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline"
            >
              Brand Kit (JSON)
            </button>
          </div>
        </div>

        {/* ---- Sales page (LP) digest + promo video ---- */}
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-hairline">
            <div className="flex items-center justify-between border-b border-hairline bg-ink/5 px-4 py-2">
              <span className="text-[11px] font-semibold">セールスページ（LP）</span>
              <button
                type="button"
                onClick={openLp}
                disabled={!html && !lpUrl}
                className="rounded-full border border-hairline bg-paper px-3 py-1 text-[11px] hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline"
              >
                LPを開く ↗
              </button>
            </div>
            <div
              className={`group relative h-[360px] overflow-hidden ${
                html ? "cursor-pointer bg-white" : "bg-ink/5"
              }`}
              onClick={html ? openLp : undefined}
              title={html ? "クリックでLP全体を開く" : undefined}
            >
              {html ? (
                <>
                  <iframe
                    title={`${kit?.service.name ?? "LP"} — LPヒーロープレビュー`}
                    srcDoc={html}
                    sandbox=""
                    scrolling="no"
                    className="pointer-events-none h-[900px] w-full origin-top-left"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-ink-muted opacity-0 transition group-hover:opacity-100">
                    クリックでLP全体を表示
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8">
                  <div className="w-full max-w-sm space-y-2 text-center">
                    <Ph className="h-6 w-3/4" />
                    <Ph className="h-3.5 w-full" />
                    <Ph className="h-3.5 w-5/6" />
                    <Ph className="mt-2 h-8 w-32 rounded-full" />
                  </div>
                  <p className="text-[11px] text-ink-faint">
                    Heroセクションのプレビュー。クリックで本物のLPが開きます
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-hairline">
            <div className="flex items-center justify-between border-b border-hairline bg-ink/5 px-4 py-2">
              <span className="text-[11px] font-semibold">紹介動画（30秒CM）</span>
              <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[10px] text-ink-muted">
                次フェーズ
              </span>
            </div>
            <div className="flex aspect-video items-center justify-center bg-ink/5">
              <div className="text-center">
                <p className="text-2xl">▶</p>
                <p className="mt-2 text-[12px] text-ink-muted">
                  下のナレーション原稿から生成されます（Phase 0b）
                </p>
              </div>
            </div>
            <div className="border-t border-hairline p-4">
              <p className="text-[11px] font-semibold text-ink-muted">
                30秒CM ナレーション原稿（動画レンダラーの入力）
              </p>
              {kit ? (
                <p className="mt-2 text-[12px] leading-relaxed">{kit.narration}</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  <Ph className="h-3.5 w-full" />
                  <Ph className="h-3.5 w-full" />
                  <Ph className="h-3.5 w-2/3" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
