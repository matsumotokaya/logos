"use client";

// Logo Motion Lab — catalog page root.
// R&D sandbox for logo motion/visual expression. The bar every experiment
// must clear: "does the logo itself look dignified?" — not "is the effect
// impressive?".

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  type ExperimentCategory,
} from "@/lab/core/experiment-api";
import {
  getLogoStoreState,
  getServerLogoStoreState,
  initLogoStore,
  subscribeLogoStore,
} from "@/lab/core/logo-store";
import { experiments, getExperiment } from "@/lab/experiments/registry";
import LogoRail from "./LogoRail";
import ExperimentCard from "./ExperimentCard";
import ExperimentModal from "./ExperimentModal";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExperimentCategory[];

export default function LabApp() {
  const store = useSyncExternalStore(
    subscribeLogoStore,
    getLogoStoreState,
    getServerLogoStoreState,
  );
  useEffect(() => {
    void initLogoStore();
  }, []);

  const [category, setCategory] = useState<ExperimentCategory | "all">("all");
  const [tech, setTech] = useState<string>("all");
  const [impression, setImpression] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const logo =
    store.logos.find((l) => l.id === store.selectedId) ?? null;

  const allTech = useMemo(
    () => [...new Set(experiments.flatMap((e) => e.meta.tech))],
    [],
  );
  const allImpressions = useMemo(
    () => [...new Set(experiments.flatMap((e) => e.meta.impressions))],
    [],
  );

  const filtered = experiments.filter(
    (e) =>
      (category === "all" || e.meta.category === category) &&
      (tech === "all" || e.meta.tech.includes(tech as never)) &&
      (impression === "all" || e.meta.impressions.includes(impression)),
  );

  const openEntry = openId ? getExperiment(openId) : undefined;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h1 className="font-display text-sm font-semibold tracking-tight">
            Logo Motion Lab
          </h1>
          <p className="hidden text-[11px] text-ink-muted sm:block">
            — 判断基準は「ロゴが立派に見えるか」。効果の派手さではない
          </p>
          <Link
            href="/"
            className="ml-auto text-xs text-ink-muted transition hover:text-ink"
          >
            ← 本体へ戻る
          </Link>
        </div>
      </header>

      {store.ready ? (
        <>
          <LogoRail logos={store.logos} selectedId={store.selectedId} />

          <div className="border-b border-hairline">
            <div className="mx-auto max-w-7xl space-y-2 px-6 py-3">
              <FilterRow
                label="カテゴリ"
                value={category}
                onChange={(v) => setCategory(v as ExperimentCategory | "all")}
                options={CATEGORIES.map((c) => [c, CATEGORY_LABELS[c]])}
              />
              <FilterRow
                label="技術"
                value={tech}
                onChange={setTech}
                options={allTech.map((t) => [t, t])}
                mono
              />
              {allImpressions.length > 0 && (
                <FilterRow
                  label="印象"
                  value={impression}
                  onChange={setImpression}
                  options={allImpressions.map((t) => [t, `#${t}`])}
                />
              )}
            </div>
          </div>

          <main className="mx-auto max-w-7xl px-6 py-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => (
                <ExperimentCard
                  key={entry.meta.id}
                  entry={entry}
                  logo={logo}
                  onOpen={setOpenId}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="py-16 text-center text-sm text-ink-muted">
                このフィルタに合致する実験はない
              </p>
            )}
          </main>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          ロゴを解析中…
        </div>
      )}

      {openEntry && logo && (
        <ExperimentModal
          entry={openEntry}
          logo={logo}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function FilterRow({
  label,
  value,
  onChange,
  options,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-[10px] tracking-widest text-ink-faint uppercase">
        {label}
      </span>
      {[["all", "すべて"] as [string, string], ...options].map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] transition",
            mono && v !== "all" && "font-mono",
            value === v
              ? "border-accent bg-accent text-white"
              : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
