"use client";

// Generative Lab — logo-first page structure.
//
// The subject of this page is the SELECTED LOGO, not the template catalog:
//   1. LogoRail   — pick the logo (shared registry across labs)
//   2. LogoReport — that logo's generation record, preset columns with
//                   instrument readouts (the dial-verification-sheet as UI)
//   3. Templates  — art directions to try NEXT with this logo; card previews
//                   show only THIS logo's latest result, never someone else's
//   4. CostPanel  — lab-wide unit-cost metering (all logos)
//
// Switching the logo swaps everything below the rail. Exploration costs real
// money, so nothing generates automatically — only the modal's explicit run.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  getLogoStoreState,
  getServerLogoStoreState,
  initLogoStore,
  subscribeLogoStore,
} from "@/labs/motion/core/logo-store";
import LogoRail from "@/labs/motion/components/LogoRail";
import {
  TAXONOMY_LABELS,
  type Taxonomy,
} from "@/labs/generative/core/expression-format";
import type {
  CatalogResponse,
  LogoRun,
  LogoRunsResponse,
} from "@/labs/generative/core/api-types";
import {
  fetchGenerativeCatalog,
  fetchLogoRuns,
} from "@/labs/generative/core/client";
import ExpressionCard from "./ExpressionCard";
import GenerateModal from "./GenerateModal";
import GenCostPanel from "./GenCostPanel";
import LogoReport from "./LogoReport";

const TAXONOMIES = Object.keys(TAXONOMY_LABELS) as Taxonomy[];

export default function GenerativeLabApp() {
  const store = useSyncExternalStore(
    subscribeLogoStore,
    getLogoStoreState,
    getServerLogoStoreState,
  );
  useEffect(() => {
    void initLogoStore();
  }, []);

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobTick, setJobTick] = useState(0);
  // Which logo the loaded report belongs to — a stale report (previous logo)
  // is never rendered under the new logo's name.
  const [report, setReport] = useState<{ logoId: string; data: LogoRunsResponse } | null>(null);

  useEffect(() => {
    fetchGenerativeCatalog()
      .then(setCatalog)
      .catch((e: unknown) =>
        setCatalogError(e instanceof Error ? e.message : "カタログ取得に失敗"),
      );
  }, []);

  const logo = store.logos.find((l) => l.id === store.selectedId) ?? null;

  // The report follows the selection: new logo (or new generation) → reload
  // that logo's record. Everything below the rail derives from it.
  useEffect(() => {
    if (!logo) return;
    let cancelled = false;
    const logoId = logo.id;
    fetchLogoRuns(logo)
      .then((r) => {
        if (!cancelled && r) setReport({ logoId, data: r });
      })
      .catch(() => {
        if (!cancelled)
          setReport({ logoId, data: { logoHash: "", runs: [], totalCostUsd: 0 } });
      });
    return () => {
      cancelled = true;
    };
  }, [logo, jobTick]);

  const onGenerated = useCallback(() => setJobTick((n) => n + 1), []);

  const templates = useMemo(() => catalog?.templates ?? [], [catalog]);
  const engines = catalog?.engines ?? [];
  const logoRuns: LogoRunsResponse | null =
    logo && report?.logoId === logo.id ? report.data : null;
  const runs = useMemo(() => logoRuns?.runs ?? [], [logoRuns]);

  const latestByTemplate = useMemo(() => {
    const map = new Map<string, LogoRun>();
    for (const run of runs) if (!map.has(run.templateId)) map.set(run.templateId, run);
    return map;
  }, [runs]);

  const usedTaxonomies = useMemo(
    () => TAXONOMIES.filter((t) => templates.some((e) => e.template?.taxonomy === t)),
    [templates],
  );
  const filtered = templates.filter(
    (e) => taxonomy === "all" || !e.template || e.template.taxonomy === taxonomy,
  );

  const openEntry = openId
    ? templates.find((e) => e.id === openId && e.template)
    : undefined;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h1 className="font-display text-sm font-semibold tracking-tight">
            Generative Lab
          </h1>
          <p className="hidden text-[11px] text-ink-muted sm:block">
            — 探索モード: ロゴを選ぶと、そのロゴの生成レポートがここに育つ
          </p>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/labs" className="text-xs text-ink-muted transition hover:text-ink">
              ← Labs
            </Link>
            <Link href="/" className="text-xs text-ink-muted transition hover:text-ink">
              本体へ戻る
            </Link>
          </div>
        </div>
      </header>

      <HarnessNote engines={engines} />

      {store.ready ? (
        <>
          <LogoRail
            logos={store.logos}
            selectedId={store.selectedId}
            note="⚠ 探索モード: 生成時、ロゴは選択テンプレートのエンジン(Together/Recraft — 学習不使用の契約確認済み)へ参照画像として送信される。キー未設定時はモックでサーバー内完結。"
          />

          {/* ① The selected logo's report — the page's deliverable. */}
          {logo &&
            (logoRuns === null ? (
              <p className="mx-auto max-w-7xl px-6 pt-8 text-sm text-ink-muted">
                {logo.name} のレポートを読み込み中…
              </p>
            ) : (
              <LogoReport
                logoName={logo.name}
                runs={runs}
                totalCostUsd={logoRuns.totalCostUsd}
                templates={templates}
                onOpenTemplate={setOpenId}
              />
            ))}

          {/* ② Art directions to try next with THIS logo. */}
          <section className="mx-auto max-w-7xl px-6 pt-10 pb-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-base font-semibold tracking-tight">
                表現テンプレート
              </h2>
              <p className="text-[11px] text-ink-muted">
                {logo ? `${logo.name} で試す` : ""} — プレビューはこのロゴの最新生成のみ
              </p>
              {usedTaxonomies.length > 1 && (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {[["all", "すべて"] as [string, string], ...usedTaxonomies.map(
                    (t) => [t, TAXONOMY_LABELS[t]] as [string, string],
                  )].map(([v, text]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTaxonomy(v as Taxonomy | "all")}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                        taxonomy === v
                          ? "border-accent bg-accent text-white"
                          : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink",
                      )}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {catalogError ? (
              <p className="py-16 text-center text-sm text-red-600">{catalogError}</p>
            ) : catalog === null ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートを読み込み中…
              </p>
            ) : templates.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートがまだない。labs/generative/templates/ にディレクトリを追加する
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((entry) => (
                  <ExpressionCard
                    key={entry.id}
                    entry={entry}
                    engines={engines}
                    latest={latestByTemplate.get(entry.id)}
                    onOpen={setOpenId}
                  />
                ))}
              </div>
            )}
          </section>

          <GenCostPanel refreshKey={jobTick} />
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          ロゴを解析中…
        </div>
      )}

      {openEntry?.template && logo && (
        <GenerateModal
          template={openEntry.template}
          engines={engines}
          logo={logo}
          recent={runs.filter((r) => r.templateId === openEntry.id)}
          onClose={() => setOpenId(null)}
          onGenerated={onGenerated}
        />
      )}
    </div>
  );
}

// The condensed, UI-facing version of labs/generative/README.md: what the
// harness means (E-1〜E-7) and where Phase E1 sits. Mirrors the Workflow
// Lab's ArchitectureNote so the two modes read as one system.
function HarnessNote({
  engines,
}: {
  engines: { id: string; name: string; roleJa: string; available: boolean }[];
}) {
  return (
    <div className="border-b border-hairline bg-white">
      <details className="group mx-auto max-w-7xl px-6 py-3">
        <summary className="cursor-pointer list-none text-[11px] text-ink-muted marker:content-none">
          <span className="mr-1 inline-block text-ink-faint transition group-open:rotate-90">
            ›
          </span>
          仕組みを見る — ハーネスとは逸脱の禁止ではなく、制御・計測・提示である(E-1〜E-7とPhase E1の位置づけ)
        </summary>
        <div className="mt-3 grid gap-4 pb-1 text-[11px] leading-relaxed text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
          <HarnessModule
            n="E-1"
            title="生成エンジン層"
            active
            body="プロバイダ抽象化の上に役割の異なる3エンジン: FLUX.2(世界構築)/ Recraft(造形展開)/ Gemini(対話修正・E3で統合)。キー未設定時はモックが代替し、その旨を明示する。"
          />
          <HarnessModule
            n="E-2"
            title="表現テンプレート"
            active
            body="生成は自由プロンプトではなく「アートディレクション」単位のテンプレートが起点。骨格は「ロゴを何として存在させるか」が先頭。ユーザー入力は無害化してラップし、生のまま渡さない。ディレクトリ追加のみで増やせる。"
          />
          <HarnessModule
            n="E-3"
            title="ダイヤル"
            active
            body="内部は4軸(形状・色・文字・世界観)、提示はプリセット3段(厳密/バランス/自由)の2階層。軸→エンジンパラメータのマッピングはテンプレート単位でチューニング可能。4軸の詳細UIはE3。"
          />
          <HarnessModule
            n="E-4"
            title="逸脱スコアボード"
            body="シルエット類似・知覚類似(LPIPS)・文字保持(OCR)・意味類似(CLIP)の総合+4軸分解を全生成物に表示(Phase E2・未着手)。全ジョブのパラメータは今日から記録している——蓄積が資産。"
          />
          <HarnessModule
            n="E-5"
            title="ワードマーク対策"
            body="実機検証の知見: ロゴ本体の短い文字は保たれ、危険なのはモデルが勝手に発明する周辺文字(脱字2/2件)。テンプレートは対応ロゴ種別を宣言済み。抑制UX(no_text等)はPhase E3。"
          />
          <HarnessModule
            n="E-6"
            title="ベンチマーク運用"
            body="Ideogram / GPT Image は本番パイプライン使用禁止のまま、社内評価ハーネスで表現上限を比較(顧客ロゴは絶対に使わない)。未着手。"
          />
          <HarnessModule
            n="E-7"
            title="マルチターン改善"
            body="一発生成ではなく対話で寄せる生成セッション(履歴・コスト上限・残量表示)。Gemini対話修正層とともにPhase E3。"
          />
          <div className="rounded-lg border border-hairline p-3">
            <p className="font-mono text-[10px] text-ink-faint">ENGINES</p>
            <ul className="mt-1 space-y-1">
              {engines.map((e) => (
                <li key={e.id} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      e.available ? "bg-emerald-500" : "bg-ink-faint",
                    )}
                  />
                  <span className="text-ink">{e.name}</span>
                  <span className="text-ink-faint">
                    {e.available ? "接続済み" : "キー未設定"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-faint">
          大原則: 「崩れたから失敗」ではない。「意図しない方向に崩れ、かつそれをユーザーが把握できない」が失敗である。
          保証モード(Workflow Lab)がロゴに触れさせないのに対し、探索モードは解釈・変形を仕様として許容し、
          方向をダイヤルで制御し、結果を計器盤で見せる。要件の正本は{" "}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">labs/generative/README.md</code>。
        </p>
      </details>
    </div>
  );
}

function HarnessModule({
  n,
  title,
  body,
  active,
}: {
  n: string;
  title: string;
  body: string;
  active?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-3", active ? "border-accent/40 bg-accent/5" : "border-hairline")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("font-mono text-[10px]", active ? "text-accent" : "text-ink-faint")}>
          {n}
        </span>
        {active ? (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] text-white">
            稼働中
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-ink-faint px-1.5 py-0.5 text-[9px] text-ink-faint">
            未着手
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
