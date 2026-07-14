"use client";

// Logo Motion Lab — catalog page root.
// R&D sandbox for logo motion/visual expression. The bar every experiment
// must clear: "does the logo itself look dignified?" — not "is the effect
// impressive?".
//
// Page skeleton (header / logo rail / logo-driven content) comes from the
// shared LabShell: pick a logo, and every experiment below renders it.

import { useMemo, useState } from "react";
import {
  CATEGORY_LABELS,
  type ExperimentCategory,
} from "@/labs/motion/core/experiment-api";
import { experiments, getExperiment } from "@/labs/motion/experiments/registry";
import LabShell from "@/labs/shared/components/LabShell";
import FilterChips from "@/labs/shared/components/FilterChips";
import ExperimentCard from "./ExperimentCard";
import ExperimentModal from "./ExperimentModal";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ExperimentCategory[];

export default function LabApp() {
  const [category, setCategory] = useState<ExperimentCategory | "all">("all");
  const [tech, setTech] = useState<string>("all");
  const [impression, setImpression] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

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
    <LabShell slug="motion">
      {(logo) => (
        <>
          <div className="border-b border-hairline">
            <div className="mx-auto max-w-6xl space-y-2 px-6 py-3">
              <FilterChips
                label="カテゴリ"
                value={category}
                onChange={(v) => setCategory(v as ExperimentCategory | "all")}
                options={CATEGORIES.map((c) => [c, CATEGORY_LABELS[c]])}
              />
              <FilterChips
                label="技術"
                value={tech}
                onChange={setTech}
                options={allTech.map((t) => [t, t])}
                mono
              />
              {allImpressions.length > 0 && (
                <FilterChips
                  label="印象"
                  value={impression}
                  onChange={setImpression}
                  options={allImpressions.map((t) => [t, `#${t}`])}
                />
              )}
            </div>
          </div>

          <main className="mx-auto max-w-6xl px-6 md:px-10 py-6">
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

          {openEntry && (
            <ExperimentModal
              entry={openEntry}
              logo={logo}
              onClose={() => setOpenId(null)}
            />
          )}
        </>
      )}
    </LabShell>
  );
}
