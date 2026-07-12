"use client";

// Workflow Lab — catalog page root.
// Phase 1 of the brand-visual pipeline: pre-built stage templates +
// deterministic composition. The bar is the same as every lab: does the
// logo itself look dignified? The logo is never touched by generative AI.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  CATEGORY_LABELS,
  type TemplateCategory,
} from "@/labs/workflow/core/template-format";
import type { CatalogEntryDto } from "@/labs/workflow/core/pipeline";
import { fetchCatalog } from "@/labs/workflow/core/client";
import TemplateCard from "./TemplateCard";
import ComposeModal from "./ComposeModal";
import CostPanel from "./CostPanel";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

export default function WorkflowLabApp() {
  const store = useSyncExternalStore(
    subscribeLogoStore,
    getLogoStoreState,
    getServerLogoStoreState,
  );
  useEffect(() => {
    void initLogoStore();
  }, []);

  const [catalog, setCatalog] = useState<CatalogEntryDto[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [jobTick, setJobTick] = useState(0);

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e: unknown) =>
        setCatalogError(e instanceof Error ? e.message : "カタログ取得に失敗"),
      );
  }, []);

  const logo = store.logos.find((l) => l.id === store.selectedId) ?? null;

  const usedCategories = useMemo(
    () =>
      CATEGORIES.filter((c) =>
        (catalog ?? []).some((e) => e.template?.category === c),
      ),
    [catalog],
  );

  const filtered = (catalog ?? []).filter(
    (e) => category === "all" || !e.template || e.template.category === category,
  );

  const openEntry = openId
    ? catalog?.find((e) => e.id === openId && e.template)
    : undefined;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h1 className="font-display text-sm font-semibold tracking-tight">
            Workflow Lab
          </h1>
          <p className="hidden text-[11px] text-ink-muted sm:block">
            — 舞台はテンプレート、ロゴは決定論的に合成。生成AIにロゴは触れさせない
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

      <ArchitectureNote />

      {store.ready ? (
        <>
          <LogoRail
            logos={store.logos}
            selectedId={store.selectedId}
            note="SVG推奨。ロゴは合成のため自サーバーにのみ送信され、外部AI・外部APIには渡らない。"
          />

          {usedCategories.length > 1 && (
            <div className="border-b border-hairline">
              <div className="mx-auto flex flex-wrap items-center gap-1.5 px-6 py-3 max-w-7xl">
                <span className="mr-1 w-14 shrink-0 text-[10px] tracking-widest text-ink-faint uppercase">
                  カテゴリ
                </span>
                {[["all", "すべて"] as [string, string], ...usedCategories.map(
                  (c) => [c, CATEGORY_LABELS[c]] as [string, string],
                )].map(([v, text]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCategory(v as TemplateCategory | "all")}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                      category === v
                        ? "border-accent bg-accent text-white"
                        : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink",
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <main className="mx-auto max-w-7xl px-6 py-6">
            {catalogError ? (
              <p className="py-16 text-center text-sm text-red-600">{catalogError}</p>
            ) : catalog === null ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートを読み込み中…
              </p>
            ) : catalog.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-muted">
                テンプレートがまだない。labs/workflow/templates/ にディレクトリを追加する
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((entry) => (
                  <TemplateCard
                    key={entry.id}
                    entry={entry}
                    logo={logo}
                    onOpen={setOpenId}
                    onComposed={() => setJobTick((n) => n + 1)}
                  />
                ))}
              </div>
            )}
          </main>

          <CostPanel refreshKey={jobTick} />
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          ロゴを解析中…
        </div>
      )}

      {openEntry?.template && logo && (
        <ComposeModal
          template={openEntry.template}
          logo={logo}
          onClose={() => setOpenId(null)}
          onComposed={() => setJobTick((n) => n + 1)}
        />
      )}
    </div>
  );
}

// The lab's whole premise ("logo untouched by AI") is easy to state and easy
// to disbelieve without seeing the pipeline. This panel is the condensed,
// UI-facing version of the requirement doc (labs/workflow/README.md) — the
// 5-layer architecture and where Phase 1 sits in it. Each card's own
// "技術解説" then drills into the specific numbers for that template.
function ArchitectureNote() {
  return (
    <div className="border-b border-hairline bg-white">
      <details className="mx-auto max-w-7xl px-6 py-3 group">
        <summary className="cursor-pointer list-none text-[11px] text-ink-muted marker:content-none">
          <span className="mr-1 inline-block text-ink-faint transition group-open:rotate-90">
            ›
          </span>
          仕組みを見る — なぜ生成AIにロゴを触らせないのか(5層アーキテクチャとPhase 1の位置づけ)
        </summary>
        <div className="mt-3 grid gap-4 pb-1 text-[11px] leading-relaxed text-ink-muted sm:grid-cols-2 lg:grid-cols-5">
          <ArchLayer
            n="1"
            title="テンプレート層"
            active
            body="舞台の見た目とロゴ合成面の仕様(logos-2d-template@1)。四隅座標・ディスプレイスメント・ライティング・クリアスペースを持つ自前フォーマット。ディレクトリを置くだけでコード変更なしにカタログへ追加される。"
          />
          <ArchLayer
            n="2"
            title="合成エンジン層"
            active
            body="sharp + 純TypeScriptのホモグラフィ/バイリニアワープ/アルファベースのコンタクトシャドウ。外部バイナリ(ImageMagick等)には依存しない、このラボが今動かしている核。"
          />
          <ArchLayer
            n="3"
            title="舞台生成層"
            body="ユーザーが独自シーンを求めた時だけAIを使う(課金機能・Phase 3・未着手)。第一候補 Recraft V4.1。ロゴは相変わらずLayer 2で決定論的に合成し、AIは背景の生成のみ担当する。"
          />
          <ArchLayer
            n="4"
            title="QAゲート層"
            body="合成結果がブランド準拠かをルールベースで自動判定(Phase 2・未着手)。ロゴ忠実度・配置ジオメトリ・生成物の不適切要素を検出する。"
          />
          <ArchLayer
            n="5"
            title="仕上げ層"
            body="印刷向けアップスケール、ライティング調和(Phase 4・未着手)。当面はテンプレート焼き込みライティングのみで対応する方針。"
          />
        </div>
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-faint">
          大原則:「舞台はAIで生成し、ロゴは決定論的に合成する」。現行の画像生成・編集モデルは「ロゴをなるべく保つ」ことはできても「絶対に不変」は保証しないため、顧客のロゴを1ピクセルも崩さない価値はレイヤー合成・テンプレート差し替えという決定論的処理でのみ担保する。要件の正本は{" "}
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">labs/workflow/README.md</code>。
        </p>
      </details>
    </div>
  );
}

function ArchLayer({
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
        <span
          className={cn(
            "font-mono text-[10px]",
            active ? "text-accent" : "text-ink-faint",
          )}
        >
          Layer {n}
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
