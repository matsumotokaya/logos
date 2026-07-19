"use client";

// Campaign Studio — NotebookLM-style intake on top of the campaign pipeline.
// Add any mix of sources (URL / PDF / images / pasted text), press generate,
// and get a Service Brand Kit + instantly rendered LP. The same kit will
// feed the promo-video renderer next.

import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { BrandKit } from "@/lib/campaign/schema";

type UiFile = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  mediaType: string;
  data: string; // base64, no data: prefix
};

type Phase = "idle" | "working" | "done" | "error";

const SAMPLES: { label: string; url: string }[] = [
  { label: "Anthropic", url: "https://www.anthropic.com" },
  { label: "Apple", url: "https://www.apple.com/jp/" },
  { label: "Google", url: "https://about.google/" },
];

const WORKING_MESSAGES = [
  "ソースを読み込んでいます…",
  "サービスを理解しています…",
  "ブランドカラーを分析しています…",
  "コピーを書いています…",
  "ナレーション原稿を練っています…",
  "LPを組み立てています…",
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

export default function CampaignStudio() {
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [files, setFiles] = useState<UiFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [workingMsg, setWorkingMsg] = useState(WORKING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const startWorkingTicker = () => {
    let i = 0;
    setWorkingMsg(WORKING_MESSAGES[0]);
    workingTimer.current = setInterval(() => {
      i = Math.min(i + 1, WORKING_MESSAGES.length - 1);
      setWorkingMsg(WORKING_MESSAGES[i]);
    }, 9000);
  };
  const stopWorkingTicker = () => {
    if (workingTimer.current) clearInterval(workingTimer.current);
    workingTimer.current = null;
  };

  const generate = async () => {
    setError(null);
    setPhase("working");
    startWorkingTicker();
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("ログインが必要です（Labsアクセス権のあるアカウント）");

      const res = await fetch("/api/labs/campaign/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      const json = (await res.json()) as
        | { kit: BrandKit; html: string }
        | { error: string };
      if (!res.ok || "error" in json) {
        throw new Error("error" in json ? json.error : `生成に失敗しました (HTTP ${res.status})`);
      }
      setKit(json.kit);
      setHtml(json.html);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
      setPhase("error");
    } finally {
      stopWorkingTicker();
    }
  };

  const reset = () => {
    setPhase("idle");
    setKit(null);
    setHtml(null);
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
          ブランドを理解した Service Brand Kit を生成し、そのままLPを組み立てます。
          動画（30秒CM）レンダラーは次のフェーズで同じKitに接続されます。
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
                {workingMsg}
              </span>
            )}
          </div>
        </section>
      )}

      {phase === "done" && kit && html && (
        <ResultView kit={kit} html={html} onReset={reset} />
      )}
    </main>
  );
}

function ResultView({
  kit,
  html,
  onReset,
}: {
  kit: BrandKit;
  html: string;
  onReset: () => void;
}) {
  const swatches = useMemo(
    () => [
      { label: "Primary", hex: kit.brand.primary },
      { label: "Accent", hex: kit.brand.accent },
      { label: "BG", hex: kit.brand.background },
      { label: "Surface", hex: kit.brand.surface },
      { label: "Text", hex: kit.brand.text },
    ],
    [kit]
  );

  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openInTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* Brand Kit panel */}
      <div className="rounded-2xl border border-hairline p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Service Brand Kit</h2>
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-ink-muted underline-offset-2 hover:underline"
          >
            別のソースで作り直す
          </button>
        </div>

        <p className="mt-4 font-display text-xl font-semibold">{kit.service.name}</p>
        <p className="text-[12px] text-ink-muted">{kit.service.tagline}</p>

        <div className="mt-4 flex gap-2">
          {swatches.map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="h-9 w-9 rounded-lg border border-hairline"
                style={{ backgroundColor: s.hex }}
                title={`${s.label} ${s.hex}`}
              />
              <p className="mt-1 text-[9px] text-ink-faint">{s.label}</p>
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-2 text-[12px]">
          <div>
            <dt className="text-ink-faint">ジャンル / ターゲット</dt>
            <dd>{kit.service.genre} / {kit.service.audience}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">ヒーローコピー</dt>
            <dd className="font-medium">{kit.copy.hero.headline}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-ink/5 p-4">
          <p className="text-[11px] font-semibold text-ink-muted">
            30秒CM ナレーション原稿（動画レンダラーの入力）
          </p>
          <p className="mt-2 text-[12px] leading-relaxed">{kit.narration}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download("index.html", html, "text/html")}
            className="rounded-full border border-hairline px-4 py-1.5 text-[12px] hover:border-ink"
          >
            LPをダウンロード
          </button>
          <button
            type="button"
            onClick={() =>
              download("brandkit.json", JSON.stringify(kit, null, 2), "application/json")
            }
            className="rounded-full border border-hairline px-4 py-1.5 text-[12px] hover:border-ink"
          >
            Brand Kit (JSON)
          </button>
          <button
            type="button"
            onClick={openInTab}
            className="rounded-full border border-hairline px-4 py-1.5 text-[12px] hover:border-ink"
          >
            新しいタブで開く
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-hairline p-4 text-[11px] text-ink-muted">
          ▶ 紹介動画（30秒CM）はこのKitから次フェーズで生成されます。LP内に動画スロットを確保済み。
        </div>
      </div>

      {/* LP preview */}
      <div className="overflow-hidden rounded-2xl border border-hairline">
        <div className="flex items-center gap-2 border-b border-hairline bg-ink/5 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-faint" />
          <span className="ml-2 truncate text-[11px] text-ink-muted">
            {kit.service.name} — 生成されたLP
          </span>
        </div>
        <iframe
          title="生成されたLPのプレビュー"
          srcDoc={html}
          sandbox=""
          className="h-[70vh] w-full bg-white"
        />
      </div>
    </section>
  );
}
