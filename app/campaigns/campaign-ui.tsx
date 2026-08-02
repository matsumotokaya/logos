"use client";

// Shared UI + types for the Campaigns surfaces:
//   /campaigns          — top page (intake + pre-filled sample)
//   /campaigns/[id]     — detail page (sidebar list + expanded digest)
// The result digest, process log and job-API helpers live here so both
// pages render campaigns identically.

import dynamic from "next/dynamic";
import { ensureSession, supabase } from "@/lib/supabase/client";
import type { CampaignBrandKit, CampaignPartial } from "@/lib/campaign/schema";
import type { CampaignCmState, CmVoiceTrack } from "@/lib/campaign/cm-types";
import type { UrlRegistrationScope } from "@/lib/brand-registration";
import { resolveTheme } from "@/lib/campaign/themes";
import { SAMPLE_CM_AUDIO, SAMPLE_CM_VIDEO } from "@/lib/campaign/sample";
import sampleCmTrackJson from "@/lib/campaign/sample-cm-track.json";
import {
  ProcessLogLines,
  type StepEvent,
  type StepLevel,
} from "./ProcessLogPopup";

export { ProcessLogPopup } from "./ProcessLogPopup";
export type { StepEvent, StepLevel } from "./ProcessLogPopup";

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
    partial?: CampaignPartial | null;
    input?: { registrationScope?: UrlRegistrationScope };
    catalog?: {
      organizationId: string;
      businessId: string;
      campaignId: string;
      logoId: string;
      syncedAt: string;
    } | null;
    catalogError?: string | null;
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
  organizationName: string | null;
  businessName: string | null;
  organizationId: string | null;
  businessId: string | null;
  registrationScope: UrlRegistrationScope;
  catalogError: string | null;
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

/**
 * Thrown when a request has no session to authenticate with. Callers that own a
 * visible affordance should catch this and open the sign-in dialog: the
 * visitor's next step is signing in, not reading about it. The message is only a
 * fallback for callers that render `.message` straight into an error slot, so it
 * stays plain — never mention roles, Labs or anything else internal.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super("サインインしてから、もう一度お試しください。");
    this.name = "AuthRequiredError";
  }
}

export async function authedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  // Guests browse on an anonymous session, established by AuthProvider on mount.
  // Establishing it here too keeps a fetch that fires before the provider
  // settles from failing on a token that is merely late, not missing.
  await ensureSession().catch(() => {});
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AuthRequiredError();
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
  steps: { ts: string; message: string; level: StepLevel }[],
): StepEvent[] {
  return steps.map((s, i) => ({
    id: i,
    ts: stepTime(s.ts),
    message: s.message,
    level: s.level,
  }));
}

// ---------------- process log ----------------

// While the job runs, the log floats as a popup window over the placeholder
// layout — the agentic process is visible without occupying the page. It
// disappears automatically when the run settles.
// After the run, the same log sits below the marketing assets as reference
// info — you can still see whether capture ran or was skipped (⚠).
export function ProcessLog({
  steps,
  working,
}: {
  steps: StepEvent[];
  working: boolean;
}) {
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
  return (
    <span
      aria-hidden
      className={`ph inline-block rounded bg-ink/10 ${className}`}
    />
  );
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
  partial,
  cm,
  audioUrl,
  videoUrl,
  onGenerateCm,
  onGenerateMp4,
  view = "catalog",
}: {
  kit: CampaignBrandKit | null;
  html: string | null;
  meta: GenerateMeta | null;
  lpUrl: string | null;
  sample: boolean;
  working: boolean;
  /** Stage artifacts of an in-flight run — fills the layout progressively
   *  (source meta → logo → palette) before the kit lands. */
  partial?: CampaignPartial | null;
  /** CM voice/video state of this job (undefined on surfaces without it). */
  cm?: CampaignCmState | null;
  /** Signed URL of the job's voice WAV, present once the voice stage is done. */
  audioUrl?: string | null;
  /** Signed URL of the rendered MP4, present once the local render finished. */
  videoUrl?: string | null;
  /** Starts the CM generation (explicit action — TTS costs API money). */
  onGenerateCm?: () => void;
  /** Exports the existing preview as MP4 and downloads it when ready. */
  onGenerateMp4?: () => void;
  /** Catalog shows every output; dedicated routes render one output in detail. */
  view?: "catalog" | "lp" | "video";
}) {
  // Everything below prefers the final kit, then falls back to the in-flight
  // partial — that fallback is what makes the layout fill piece by piece.
  const logoSvg = kit?.assets?.logo_svg ?? partial?.logo?.logo_svg ?? null;
  const logoPng = kit?.assets?.logo ?? partial?.logo?.logo ?? null;
  const theme = kit ? resolveTheme(kit) : null;
  // Dark-canvas LPs (glass variant) need a dark preview frame and fade.
  const glassLp = theme?.lp.variant === "glass";

  const brandColors = kit?.brand ?? partial?.palette ?? null;
  const swatches = brandColors
    ? [
        { label: "Primary", hex: brandColors.primary },
        { label: "Accent", hex: brandColors.accent },
        { label: "BG", hex: brandColors.background },
        { label: "Surface", hex: brandColors.surface },
        { label: "Text", hex: brandColors.text },
      ]
    : [
        { label: "Primary", hex: null },
        { label: "Accent", hex: null },
        { label: "BG", hex: null },
        { label: "Surface", hex: null },
        { label: "Text", hex: null },
      ];

  const designTokens = kit?.design_tokens ?? partial?.design_tokens ?? null;
  const tokens: { label: string; value: string | null }[] = designTokens
    ? [
        { label: "本文フォント", value: designTokens.body_font },
        { label: "見出しフォント", value: designTokens.heading_font },
        { label: "ボタン角丸", value: designTokens.button_radius },
        { label: "ボタン余白", value: designTokens.button_padding },
        { label: "セクション余白", value: designTokens.section_spacing },
        { label: "コンテンツ幅", value: designTokens.container_width },
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
      {view === "catalog" ? (
        <>
          {/* ---- Service header: the analysis, one level above the assets ---- */}
          <header className="border-b border-hairline pb-8">
            <div className="max-w-4xl">
              {kit ? (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-balance font-display text-3xl font-semibold">
                      {kit.service.name}
                    </h1>
                    {sample ? (
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-semibold tracking-normal text-ink-muted">
                        サンプル
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-pretty text-lg text-ink-muted">
                    {kit.service.tagline}
                  </p>
                  {kit.service.description !== kit.service.tagline ? (
                    <p className="mt-3 max-w-3xl text-pretty text-sm leading-7 text-ink-muted">
                      {kit.service.description}
                    </p>
                  ) : null}
                </>
              ) : partial?.source ? (
                <>
                  <div className="fill-in flex flex-wrap items-center gap-2.5">
                    <h1 className="text-balance font-display text-3xl font-semibold">
                      {partial.source.title ?? "（タイトル解析中）"}
                    </h1>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold tracking-normal text-amber-700">
                      取得情報（仮）
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-pretty text-sm leading-7 text-ink-muted">
                    {partial.source.description ??
                      `${partial.source.url} — 分析・執筆中…`}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-balance font-display text-3xl font-semibold text-ink-faint">
                    サービス分析
                  </h1>
                  <p className="mt-2 text-pretty text-sm text-ink-faint">
                    ソースから読み取ったサービスの実像がここに入ります
                  </p>
                </>
              )}
            </div>
            <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-hairline pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-xs text-ink-faint">業種</dt>
                <dd className="mt-1 text-pretty font-medium">
                  {kit ? kit.service.industry : <Ph className="h-4 w-28" />}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">事業タイプ</dt>
                <dd className="mt-1 text-pretty font-medium">
                  {kit ? (
                    (BUSINESS_TYPE_LABELS[kit.service.business_type] ??
                    kit.service.business_type)
                  ) : (
                    <Ph className="h-4 w-20" />
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-faint">提供価値</dt>
                <dd className="mt-1 text-pretty font-medium">
                  {kit ? (
                    kit.service.offering
                  ) : (
                    <Ph className="h-4 w-full max-w-md" />
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2 xl:col-span-4">
                <dt className="text-xs text-ink-faint">ターゲット</dt>
                <dd className="mt-1 text-pretty font-medium">
                  {kit ? kit.service.audience : <Ph className="h-4 w-56" />}
                </dd>
              </div>
            </dl>
          </header>

          <h2 className="mt-8 text-balance font-display text-lg font-semibold">
            マーケティングアセット
          </h2>
        </>
      ) : null}

      <div
        className={
          view === "catalog" ? "mt-4 grid gap-6 xl:grid-cols-2" : "mt-6"
        }
      >
        {/* ---- Service Brand Kit: the design system ---- */}
        {view === "catalog" ? (
          <div className="rounded-2xl border border-hairline p-6">
            <h3 className="text-sm font-semibold">Service Brand Kit</h3>
            <p className="mt-1 text-[11px] text-ink-muted">
              ロゴ・カラー・タイポグラフィなど、全アセット共通のデザイン基盤
            </p>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink-muted">ロゴ</p>
              {logoSvg || logoPng ? (
                <div className="fill-in mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded-xl border border-hairline bg-white p-3">
                    {/* base64 data URI from our own capture — next/image not applicable */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        logoSvg
                          ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(logoSvg)))}`
                          : `data:${logoPng!.media_type};base64,${logoPng!.data}`
                      }
                      alt={`${kit?.service.name ?? partial?.source?.title ?? "サービス"} のロゴ`}
                      className="h-10 w-auto max-w-[200px] object-contain"
                    />
                  </span>
                  {logoSvg && (
                    <span
                      className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                      title="サイトからSVGベクターとして取得したデータ（インラインSVGまたは参照ファイル）"
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
              <p className="text-[11px] font-semibold text-ink-muted">
                カラーパレット
              </p>
              <div className="mt-2 flex gap-2">
                {swatches.map((s, i) => (
                  <div key={s.label} className="text-center">
                    <div
                      className={`h-9 w-9 rounded-lg border border-hairline ${
                        s.hex
                          ? "fill-in"
                          : `bg-ink/5 ${working ? "animate-pulse" : ""}`
                      }`}
                      style={
                        s.hex
                          ? {
                              backgroundColor: s.hex,
                              animationDelay: `${i * 90}ms`,
                            }
                          : undefined
                      }
                      title={s.hex ? `${s.label} ${s.hex}` : s.label}
                    />
                    <p className="mt-1 text-[9px] text-ink-faint">{s.label}</p>
                  </div>
                ))}
              </div>
              {!brandColors && partial?.palette_candidates && (
                <div className="fill-in mt-2 flex flex-wrap items-center gap-1.5">
                  {partial.palette_candidates.map((hex) => (
                    <span
                      key={hex}
                      className="h-4 w-4 rounded-full border border-hairline"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                  <span className="text-[10px] text-ink-faint">
                    証拠色を収集 — 役割を裁定中…
                  </span>
                </div>
              )}
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
                    {kit.brand.palette_source === "extracted"
                      ? "サイトから抽出"
                      : "AI提案"}
                  </span>
                ) : partial?.palette ? (
                  <span
                    className="fill-in rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                    title="実際のサイトをレンダリングして収集した証拠から選ばれたパレット"
                  >
                    サイトから抽出
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
                デザインテーマ
              </p>
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
                <dl className="fill-in mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px]">
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
                  {[
                    "本文フォント",
                    "見出しフォント",
                    "ボタン角丸",
                    "セクション余白",
                  ].map((label) => (
                    <div key={label} className="contents">
                      <dt className="text-ink-faint">{label}</dt>
                      <dd>
                        <Ph className="h-3 w-24" />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={!kit}
                onClick={() =>
                  kit &&
                  download(
                    "brandkit.json",
                    JSON.stringify(kit, null, 2),
                    "application/json",
                  )
                }
                className="rounded-full border border-hairline px-4 py-1.5 text-[12px] hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline"
              >
                Brand Kit (JSON)
              </button>
            </div>
          </div>
        ) : null}

        {/* ---- Sales page (LP) digest + promo video ---- */}
        <div
          className={
            view === "catalog"
              ? "flex flex-col gap-6"
              : "mx-auto flex w-full max-w-5xl flex-col gap-6"
          }
        >
          {view !== "video" ? (
            <div
              id="campaign-lp"
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-hairline"
            >
              <div className="flex items-center justify-between border-b border-hairline bg-ink/5 px-4 py-2">
                <span className="flex items-center gap-2 text-[11px] font-semibold">
                  セールスページ（LP）
                  {working && kit && !sample && (
                    <span className="flex items-center gap-1.5 text-[10px] font-normal text-ink-muted">
                      <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-ink-faint border-t-ink" />
                      元サイトと照合中…
                    </span>
                  )}
                </span>
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
                className={`group relative overflow-hidden ${
                  view === "lp"
                    ? "h-[70dvh] min-h-96 max-h-[800px]"
                    : "h-[360px]"
                } ${
                  html ? (glassLp ? "bg-[#0a0f1e]" : "bg-white") : "bg-ink/5"
                }`}
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
                    <button
                      type="button"
                      onClick={openLp}
                      aria-label="LP全体を新しいタブで開く"
                      className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    />
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
          ) : null}

          {view !== "lp" ? (
            <div
              id="campaign-video"
              className="scroll-mt-24 rounded-2xl border border-hairline"
            >
              <div className="flex items-center justify-between border-b border-hairline bg-ink/5 px-4 py-2">
                <span className="text-[11px] font-semibold">
                  製品紹介動画（30秒CM）
                </span>
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
                <CmVideoPlayer
                  kit={kit}
                  track={sampleCmTrack}
                  audioSrc={SAMPLE_CM_AUDIO}
                />
              ) : cm?.track && kit ? (
                // The Player starts as soon as the voice stage is done. MP4
                // export remains a separate, explicit action below.
                <CmVideoPlayer
                  kit={kit}
                  track={cm.track}
                  audioSrc={audioUrl ?? null}
                />
              ) : cm?.status === "running" ? (
                <div className="flex aspect-video items-center justify-center bg-ink/5">
                  <div className="text-center">
                    <span className="mx-auto inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-faint border-t-ink" />
                    <p className="mt-3 text-[12px] text-ink-muted">
                      製品紹介動画を生成中…
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-ink/5">
                  <div className="text-center">
                    {kit && kit.cm_script?.length && onGenerateCm ? (
                      <div>
                        <button
                          type="button"
                          onClick={onGenerateCm}
                          className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold text-paper hover:opacity-85"
                        >
                          製品紹介動画を生成
                        </button>
                        {cm?.status === "error" && cm.error && (
                          <p className="mt-3 text-[11px] text-amber-700">
                            前回: {cm.error}
                          </p>
                        )}
                      </div>
                    ) : kit && !kit.cm_script?.length ? (
                      <p className="px-8 text-[12px] text-ink-muted">
                        このキャンペーンは旧形式です。再生成すると製品紹介動画を作成できます
                      </p>
                    ) : (
                      <>
                        <p className="text-2xl">▶</p>
                        <p className="mt-2 text-[12px] text-ink-muted">
                          ここに製品紹介動画が表示されます
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {(sample || cm?.track) && (
                <div className="flex items-center justify-end border-t border-hairline px-4 py-2">
                  {videoUrl || sample ? (
                    <a
                      href={sample ? SAMPLE_CM_VIDEO : (videoUrl as string)}
                      download
                      className="rounded-full border border-hairline px-3 py-1 text-[11px] hover:border-ink"
                    >
                      MP4をダウンロード
                    </a>
                  ) : onGenerateMp4 ? (
                    <button
                      type="button"
                      onClick={onGenerateMp4}
                      disabled={cm?.status === "running"}
                      className="rounded-full border border-hairline px-3 py-1 text-[11px] hover:border-ink disabled:cursor-wait disabled:opacity-50"
                    >
                      {cm?.status === "running"
                        ? "MP4ファイルを作成中…"
                        : "MP4ファイルを作成してダウンロード"}
                    </button>
                  ) : null}
                </div>
              )}
              <div className="border-t border-hairline p-4">
                <p className="text-[11px] font-semibold text-ink-muted">
                  ナレーション
                </p>
                {kit ? (
                  <p className="mt-2 text-[12px] leading-relaxed">
                    {kit.narration}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    <Ph className="h-3.5 w-full" />
                    <Ph className="h-3.5 w-full" />
                    <Ph className="h-3.5 w-2/3" />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
