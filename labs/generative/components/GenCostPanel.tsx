"use client";

// Cost + success-rate readout for exploration mode. Per-template AND
// per-engine, with real dollars — the mode where 原価計測 stops being
// hypothetical. The dataset behind it (jobs.jsonl) is the成功率分析 asset
// the requirement doc calls out.

import { useEffect, useState } from "react";
import type { GenJobsSummary } from "@/labs/generative/core/api-types";
import { fetchGenJobsSummary } from "@/labs/generative/core/client";

export default function GenCostPanel({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<GenJobsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchGenJobsSummary()
        .then((s) => !cancelled && setSummary(s))
        .catch(() => {});
    }, 400);
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
            全{summary.totalJobs}ジョブ・累計 ${summary.totalCostUsd.toFixed(3)}
            (var/generative-lab/jobs.jsonl)
          </span>
        </div>

        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="text-ink-faint">
                <th className="py-1 pr-4 font-normal">テンプレート</th>
                <th className="py-1 pr-4 font-normal">ジョブ</th>
                <th className="py-1 pr-4 font-normal">失敗</th>
                <th className="py-1 pr-4 font-normal">平均ms</th>
                <th className="py-1 font-normal">コスト</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {summary.byTemplate.map((t) => (
                <tr key={t.templateId} className="border-t border-hairline">
                  <td className="py-1.5 pr-4 text-ink">{t.templateId}</td>
                  <td className="py-1.5 pr-4">{t.jobs}</td>
                  <td className="py-1.5 pr-4">{t.failures || "—"}</td>
                  <td className="py-1.5 pr-4">{t.avgGenMs}</td>
                  <td className="py-1.5">${t.totalCostUsd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full self-start text-left font-mono text-[11px]">
            <thead>
              <tr className="text-ink-faint">
                <th className="py-1 pr-4 font-normal">エンジン</th>
                <th className="py-1 pr-4 font-normal">ジョブ</th>
                <th className="py-1 pr-4 font-normal">失敗</th>
                <th className="py-1 font-normal">コスト</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {summary.byEngine.map((e) => (
                <tr key={e.engine} className="border-t border-hairline">
                  <td className="py-1.5 pr-4 text-ink">{e.engine}</td>
                  <td className="py-1.5 pr-4">{e.jobs}</td>
                  <td className="py-1.5 pr-4">{e.failures || "—"}</td>
                  <td className="py-1.5">${e.totalCostUsd.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
