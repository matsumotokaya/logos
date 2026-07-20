"use client";

// Shared UI + types for the Campaigns surfaces:
//   /campaigns          — top page (intake + pre-filled sample)
//   /campaigns/[id]     — detail page (sidebar list + expanded digest)
// The result digest, process log and job-API helpers live here so both
// pages render campaigns identically.

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase/client";
import type { CampaignBrandKit } from "@/lib/campaign/schema";
import type { CampaignCmState, CmVoiceTrack } from "@/lib/campaign/cm-types";
import { resolveTheme } from "@/lib/campaign/themes";
import { SAMPLE_CM_AUDIO, SAMPLE_CM_VIDEO } from "@/lib/campaign/sample";
import sampleCmTrackJson from "@/lib/campaign/sample-cm-track.json";

// Remotion is heavy — load the Player only when a campaign actually has a
// voice track to play.
const CmVideoPlayer = dynamic(() => import("./CmVideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center bg-ink/5 text-[12px] text-ink-muted">
      プレビューを読み込み中…
    </div>
  ),
});

const sampleCmTrack = sampleCmTrackJson as unknown as CmVoiceTrack;

export type GenerateMeta = {
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

export type StepLevel = "info" | "success" | "warn";
export type StepEvent = { id: number; ts: string; message: string; level: StepLevel };

export type JobPayload = {
  job: {
    id: string;
    status: "running" | "done" | "error";
    createdAt: string;
    steps: { ts: string; message: string; level: StepLevel }[];
    kit: CampaignBrandKit | null;
    meta: GenerateMeta | null;
    error: string | null;
    cm?: CampaignCmState | null;
  } | null;
  html?: string | null;
  lpUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
};

export type JobSummary = {
  id: string;
  createdAt: string;
  status: "running" | "done" | "error";
  name: string;
  tagline: string | null;
  primary: string | null;
  accent: string | null;
};

export const POLL_INTERVAL_MS = 2500;

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

export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です（Labsアクセス権のあるアカウント）");
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

export const stepTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", { hour12: false });

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};

export function toStepEvents(
  steps: { ts: string; message: string; level: StepLevel }[]
): StepEvent[] {
  return steps.map((s, i) => ({
    id: i,
    ts: stepTime(s.ts),
    message: s.message,
    level: s.level,
  }));
}

// ---------------- process log ----------------

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
export function ProcessLogPopup({ steps }: { steps: StepEvent[] }) {
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
export function ProcessLog({ steps, working }: { steps: StepEvent[]; working: boolean }) {
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
export function Ph({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`ph inline-block rounded bg-ink/10 ${className}`} />;
}

// ---------------- result digest ----------------

// Result digest — the expanded view of one campaign. Placeholders (grey bars)
// before/while a run, real data when it completes, sample content on the
// bundled sample. Structure follows the information hierarchy:
//   1. Service header — what this business IS (analysis of the sources)
//   2. Marketing assets — what was generated FROM it:
//      Service Brand Kit (design), sales page (LP), promo video (+ narration)
export function ResultDigest({
  kit,
  html,
  meta,
  lpUrl,
  sample,
  working,
  cm,
  audioUrl,
  videoUrl,
  onGenerateCm,
}: {
  kit: CampaignBrandKit | null;
  html: string | null;
  meta: GenerateMeta | null;
  lpUrl: string | null;
  sample: boolean;
  working: boolean;
  /** CM voice/video state of this job (undefined on surfaces without it). */
  cm?: CampaignCmState | null;
  /** Signed URL of the job's voice WAV, present once the voice stage is done. */
  audioUrl?: string | null;
  /** Signed URL of the rendered MP4, present once the local render finished. */
  videoUrl?: string | null;
  /** Starts the CM generation (explicit action — TTS costs API money). */
  onGenerateCm?: () => void;
}) {
  const logoSvg = kit?.assets?.logo_svg ?? null;
  const logoPng = kit?.assets?.logo ?? null;
  const theme = kit ? resolveTheme(kit) : null;
  // Dark-canvas LPs (glass variant) need a dark preview frame and fade.
  const glassLp = theme?.lp.variant === "glass";

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
    <section className={working ? "[&_.ph]:animate-pulse" : ""}>
      {/* ---- Service header: the analysis, one level above the assets ---- */}
      <div className="rounded-2xl border border-hairline bg-paper p-6">
        <div>
          {kit ? (
            <>
              <p className="flex items-center gap-2.5 font-display text-2xl font-semibold">
                {kit.service.name}
                {sample && (
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-semibold tracking-normal text-ink-muted">
                    サンプル
                  </span>
                )}
              </p>
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

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        {/* ---- Service Brand Kit: the design system ---- */}
        <div className="rounded-2xl border border-hairline p-6">
          <h3 className="text-sm font-semibold">Service Brand Kit</h3>
          <p className="mt-1 text-[11px] text-ink-muted">
            ロゴ・カラー・タイポグラフィなど、全アセット共通のデザイン基盤
          </p>

          <div className="mt-4">
            <p className="text-[11px] font-semibold text-ink-muted">ロゴ</p>
            {kit && (logoSvg || logoPng) ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-block rounded-xl border border-hairline bg-white p-3">
                  {/* base64 data URI from our own capture — next/image not applicable */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      logoSvg
                        ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(logoSvg)))}`
                        : `data:${logoPng!.media_type};base64,${logoPng!.data}`
                    }
                    alt={`${kit.service.name} のロゴ`}
                    className="h-10 w-auto max-w-[200px] object-contain"
                  />
                </span>
                {logoSvg && (
                  <span
                    className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                    title="サイトのインラインSVGから計算済みスタイルを焼き込んで取得したベクターデータ"
                  >
                    SVGベクター取得
                  </span>
                )}
              </div>
            ) : kit ? (
              <p className="mt-2 text-[12px] text-ink-muted">
                {sample
                  ? "ワードマーク（タイポグラフィ）を使用"
                  : "取得できず — ワードマーク（タイポグラフィ）で代替"}
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
              {sample ? (
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  ブランドガイドライン準拠
                </span>
              ) : kit ? (
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
            <p className="text-[11px] font-semibold text-ink-muted">デザインテーマ</p>
            {theme ? (
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-semibold"
                  title={theme.direction}
                >
                  {theme.label}
                </span>
                <span className="text-[11px] text-ink-muted">
                  LP・動画・バナー共通のトーン&マナー
                </span>
              </p>
            ) : (
              <Ph className="mt-2 h-3.5 w-40" />
            )}
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
              <p className="mt-2 text-[12px] text-ink-muted">
                {sample ? "サンプルでは省略" : "取得できず"}
              </p>
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
                html ? `cursor-pointer ${glassLp ? "bg-[#0a0f1e]" : "bg-white"}` : "bg-ink/5"
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
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t ${
                      glassLp ? "from-[#0a0f1e]" : "from-white"
                    } to-transparent`}
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] opacity-0 transition group-hover:opacity-100 ${
                      glassLp ? "text-white/60" : "text-ink-muted"
                    }`}
                  >
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
              <span className="text-[11px] font-semibold">製品紹介動画（30秒CM）</span>
              {cm?.track?.mock ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  モック音声
                </span>
              ) : cm?.status === "running" && cm.track ? (
                <span className="flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-0.5 text-[10px] text-ink-muted">
                  <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-ink-faint border-t-ink" />
                  MP4を書き出し中
                </span>
              ) : sample || cm?.track ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  生成済み
                </span>
              ) : (
                <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[10px] text-ink-muted">
                  未生成
                </span>
              )}
            </div>
            {sample && kit ? (
              <CmVideoPlayer kit={kit} track={sampleCmTrack} audioSrc={SAMPLE_CM_AUDIO} />
            ) : cm?.track && kit ? (
              // The Player starts as soon as the voice stage is done — the
              // MP4 keeps rendering in the background for the LP embed.
              <CmVideoPlayer kit={kit} track={cm.track} audioSrc={audioUrl ?? null} />
            ) : cm?.status === "running" ? (
              <div className="flex aspect-video items-center justify-center bg-ink/5">
                <div className="text-center">
                  <span className="mx-auto inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
                  <p className="mt-3 text-[12px] text-ink-muted">
                    製品紹介動画を生成中…（右下の処理ログに進捗が出ます）
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-ink/5">
                <div className="text-center">
                  {kit && kit.cm_script?.length && onGenerateCm ? (
                    <>
                      <button
                        type="button"
                        onClick={onGenerateCm}
                        className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-paper hover:opacity-85"
                      >
                        製品紹介動画を生成
                      </button>
                      <p className="mt-3 text-[11px] text-ink-muted">
                        ナレーション音声合成＋映像組み立て。完成するとLPの動画スロットにも掲載されます
                        {cm?.status === "error" && cm.error && (
                          <span className="mt-1 block text-amber-700">
                            前回: {cm.error}
                          </span>
                        )}
                      </p>
                    </>
                  ) : kit && !kit.cm_script?.length ? (
                    <p className="px-8 text-[12px] text-ink-muted">
                      このキャンペーンは旧形式です。再生成すると製品紹介動画を作成できます
                    </p>
                  ) : (
                    <>
                      <p className="text-2xl">▶</p>
                      <p className="mt-2 text-[12px] text-ink-muted">
                        Brand Kitとナレーション原稿から、30秒CMがここに生成されます
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
            {(sample || videoUrl) && (
              <div className="flex items-center justify-between border-t border-hairline px-4 py-2">
                <span className="text-[10px] text-ink-muted">
                  MP4書き出し済み — セールスページ（LP）の動画スロットにも掲載中
                </span>
                <a
                  href={sample ? SAMPLE_CM_VIDEO : (videoUrl as string)}
                  download
                  className="rounded-full border border-hairline px-3 py-1 text-[11px] hover:border-ink"
                >
                  MP4をダウンロード
                </a>
              </div>
            )}
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
