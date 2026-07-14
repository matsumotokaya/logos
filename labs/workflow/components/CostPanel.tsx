"use client";

// Unit-cost readout: per-template aggregates from the job log. This is the
// visible face of the "cost metering from day one" product requirement.

import { useEffect, useState } from "react";
import type { JobsSummary } from "@/labs/workflow/core/pipeline";
import { fetchJobsSummary } from "@/labs/workflow/core/client";

export default function CostPanel({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<JobsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Trailing debounce: card bursts (logo switch) collapse into one fetch.
    const timer = setTimeout(() => {
      fetchJobsSummary()
        .then((s) => !cancelled && setSummary(s))
        .catch(() => {});
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshKey]);

  if (!summary || summary.totalJobs === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 md:px-10 pb-10">
      <div className="rounded-xl border border-hairline bg-white p-4">
        <div className="flex items-baseline gap-2">
          <h3 className="font-mono text-[11px] tracking-widest text-ink-muted uppercase">
            原価計測
          </h3>
          <span className="text-[11px] text-ink-faint">
            全{summary.totalJobs}ジョブ(var/workflow-lab/jobs.jsonl)
          </span>
        </div>
        <table className="mt-3 w-full text-left font-mono text-[11px]">
          <thead>
            <tr className="text-ink-faint">
              <th className="py-1 pr-4 font-normal">テンプレート</th>
              <th className="py-1 pr-4 font-normal">ジョブ</th>
              <th className="py-1 pr-4 font-normal">失敗</th>
              <th className="py-1 pr-4 font-normal">平均ms</th>
              <th className="py-1 pr-4 font-normal">最大ms</th>
              <th className="py-1 font-normal">外部APIコスト</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {summary.byTemplate.map((t) => (
              <tr key={t.templateId} className="border-t border-hairline">
                <td className="py-1.5 pr-4 text-ink">{t.templateId}</td>
                <td className="py-1.5 pr-4">{t.jobs}</td>
                <td className="py-1.5 pr-4">{t.failures || "—"}</td>
                <td className="py-1.5 pr-4">{t.avgRenderMs}</td>
                <td className="py-1.5 pr-4">{t.maxRenderMs}</td>
                <td className="py-1.5">${t.totalExternalCostUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
