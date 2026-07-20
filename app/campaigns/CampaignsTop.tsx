"use client";

// /campaigns top — the front door of CM Maker. Intake (URL / files / text)
// plus the bundled sample rendered as the pre-filled placeholder: you can see
// what a run produces before running one. Starting a generation navigates to
// the campaign's own detail page (/campaigns/[jobId]) where the run lives;
// past campaigns appear as cards linking to their detail pages.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import heroBg from "@/public/campaigns/bg/simon-nilsen.jpg";
import { sampleCampaignKit, SAMPLE_CAMPAIGN_ID } from "@/lib/campaign/sample";
import {
  ResultDigest,
  authedFetch,
  formatDate,
  type JobSummary,
} from "./campaign-ui";

type UiFile = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  mediaType: string;
  data: string; // base64, no data: prefix
};

const SAMPLES: { label: string; url: string }[] = [
  { label: "Anthropic", url: "https://www.anthropic.com" },
  { label: "Apple", url: "https://www.apple.com/jp/" },
  { label: "Google", url: "https://about.google/" },
];

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

export default function CampaignsTop({ sampleHtml }: { sampleHtml: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [files, setFiles] = useState<UiFile[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasSource = url.trim() !== "" || files.length > 0 || pastedText.trim() !== "";

  // The pre-filled sample yields to grey placeholders as soon as the user
  // starts adding their own sources.
  const sampleMode = !hasSource;

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const added: UiFile[] = [];
    for (const f of Array.from(list)) {
      const ui = await fileToUiFile(f);
      if (ui) added.push(ui);
    }
    if (added.length) setFiles((prev) => [...prev, ...added].slice(0, 5));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch("/api/labs/campaign/jobs?list=1");
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { jobs?: JobSummary[] };
        if (!cancelled) setJobs(json.jobs ?? []);
      } catch {
        // signed out: sample-only view
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async () => {
    setError(null);
    setStarting(true);
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
      // The run lives on its own page from here on.
      router.push(`/campaigns/${json.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
      setStarting(false);
    }
  };

  return (
    <main>
      {/* Full-viewport hero: copy on the left, the intake as a macOS-style
          frosted glass card on the right, over a full-bleed photograph.
          The floating app header is cleared with top padding. */}
      <section className="relative flex min-h-dvh items-center overflow-hidden bg-[#101a3c]">
        <Image
          src={heroBg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        {/* Legibility scrim over the photo. */}
        <div aria-hidden className="absolute inset-0 bg-[#060b22]/40" />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 pt-28 pb-20 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16 lg:pt-32">
          {/* Left: title + pitch */}
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Campaigns — CM Maker
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem] lg:leading-[1.2]">
              {/* inline-block per phrase: wrap between phrases, never mid-word */}
              <span className="inline-block">ソースを追加するだけで、</span>
              <span className="inline-block">セールスページと30秒CMを。</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-pretty text-white/70 md:text-base">
              URL・PDF・スクリーンショット・テキスト。サービスの内容がわかるものを渡すと、
              ブランドを理解した Service Brand Kit を生成し、セールスページ・紹介動画などの
              マーケティングアセットが一式で出てきます。
            </p>
            <p className="mt-4 text-[12px] text-white/50">
              生成を始めると、キャンペーンごとの専用ページへ移動します。
              サンプル（CM Maker 自身のセールスページ）は下に。
            </p>
          </header>

          {/* Right: intake as a frosted glass card */}
          <section
            aria-label="ソースを追加"
            className="rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl"
          >
            <h2 className="text-sm font-semibold text-white">ソースを追加</h2>

            {/* URL row + samples */}
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-service.example.com"
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/60 focus:bg-white/15"
              disabled={starting}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-white/50">試しに:</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => setUrl(s.url)}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/60 transition hover:border-white/60 hover:text-white"
                  disabled={starting}
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
              className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                dragOver
                  ? "border-white bg-white/15"
                  : "border-white/25 hover:border-white/50"
              }`}
            >
              <p className="text-sm text-white/70">
                PDF・画像をドロップ、またはクリックして選択
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                チラシ / 企画書 / スクリーンショット など（5個・各4.5MBまで）
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
                    className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80"
                  >
                    <span>{f.kind === "pdf" ? "📄" : "🖼"}</span>
                    <span className="max-w-[180px] truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`${f.name} を削除`}
                      onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="text-white/40 hover:text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Paste text */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowPaste((v) => !v)}
                className="text-[12px] text-white/60 underline-offset-2 hover:text-white hover:underline"
              >
                {showPaste ? "テキスト貼り付けを閉じる" : "コピーしたテキストを貼り付ける"}
              </button>
              {showPaste && (
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={4}
                  placeholder="サービス概要・プレスリリース・紹介文などを貼り付け"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/60 focus:bg-white/15"
                  disabled={starting}
                />
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-300/40 bg-red-500/20 px-4 py-2 text-[12px] text-red-100">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void generate()}
              disabled={!hasSource || starting}
              className="mt-5 w-full rounded-full bg-white px-8 py-3 text-sm font-semibold text-[#101a3c] transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {starting ? "開始しています…" : "LPと動画素材を生成"}
            </button>
            {starting && (
              <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-white/60">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                キャンペーンページへ移動します…
              </p>
            )}
          </section>
        </div>

        {/* Below-the-fold cue */}
        <a
          href="#browse"
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1.5 text-[11px] text-white/50 transition hover:text-white"
        >
          サンプルとあなたのキャンペーン ↓
        </a>
      </section>

      <div id="browse" className="mx-auto max-w-6xl px-6 py-12 md:px-10">
        {/* Your campaigns — cards into each detail page. */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">あなたのキャンペーン</h2>
            <span className="text-[11px] text-ink-muted">
              カードを選ぶと専用ページが開きます
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={`/campaigns/${SAMPLE_CAMPAIGN_ID}`}
              className="rounded-2xl border border-hairline p-5 transition hover:border-ink"
            >
              <div className="flex items-center justify-between">
                <span className="flex gap-1.5">
                  <span
                    className="h-4 w-4 rounded-full border border-hairline"
                    style={{ backgroundColor: sampleCampaignKit.brand.primary }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-hairline"
                    style={{ backgroundColor: sampleCampaignKit.brand.accent }}
                  />
                </span>
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                  サンプル
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-semibold">
                {sampleCampaignKit.service.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                {sampleCampaignKit.service.tagline}
              </p>
            </Link>

            {(jobs ?? []).map((j) => (
              <Link
                key={j.id}
                href={`/campaigns/${j.id}`}
                className="rounded-2xl border border-hairline p-5 transition hover:border-ink"
              >
                <div className="flex items-center justify-between">
                  <span className="flex gap-1.5">
                    {[j.primary, j.accent].map((hex, i) =>
                      hex ? (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-hairline"
                          style={{ backgroundColor: hex }}
                        />
                      ) : (
                        <span key={i} className="h-4 w-4 rounded-full bg-ink/10" />
                      )
                    )}
                  </span>
                  {j.status === "running" ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                      <span className="inline-block h-2 w-2 animate-spin rounded-full border border-ink-faint border-t-ink" />
                      生成中
                    </span>
                  ) : j.status === "error" ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-600">
                      エラー
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-faint tabular-nums">
                      {formatDate(j.createdAt)}
                    </span>
                  )}
                </div>
                <p className="mt-3 truncate text-sm font-semibold">{j.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                  {j.tagline ?? "—"}
                </p>
              </Link>
            ))}
          </div>
          {jobs !== null && jobs.length === 0 && (
            <p className="mt-3 text-[11px] text-ink-faint">
              まだ自分のキャンペーンがありません。上でソースを追加して最初の1本を生成してください。
            </p>
          )}
        </section>

        {/* The sample digest — the placeholder that shows what a run produces. */}
        <div className="mt-10">
          <ResultDigest
            kit={sampleMode ? sampleCampaignKit : null}
            html={sampleMode ? sampleHtml : null}
            meta={null}
            lpUrl={sampleMode ? "/c/sample" : null}
            sample={sampleMode}
            working={false}
          />
        </div>
      </div>
    </main>
  );
}
