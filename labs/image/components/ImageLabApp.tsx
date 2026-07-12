"use client";

// Image Lab — catalog page root.
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
} from "@/labs/image/core/template-format";
import type { CatalogEntryDto } from "@/labs/image/core/pipeline";
import { fetchCatalog } from "@/labs/image/core/client";
import TemplateCard from "./TemplateCard";
import ComposeModal from "./ComposeModal";
import CostPanel from "./CostPanel";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

export default function ImageLabApp() {
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
            Image Lab
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
                テンプレートがまだない。labs/image/templates/ にディレクトリを追加する
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
