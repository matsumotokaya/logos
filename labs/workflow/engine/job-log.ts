// Per-job cost metering — a product requirement from day one.
//
// Every compose job is appended to var/workflow-lab/jobs.jsonl (gitignored).
// The record shape anticipates Phase 3: external API cost and retry count
// are recorded now (always 0 for deterministic composition) so the price
// modelling queries don't change when the AI stage-generation layer lands.
// The same file doubles as the audit trail skeleton: which logo (hash only,
// never the artwork) went through which pipeline, when.

import path from "node:path";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { JobsSummary } from "@/labs/workflow/core/pipeline";

const LOG_DIR = path.join(process.cwd(), "var", "workflow-lab");
const LOG_FILE = path.join(LOG_DIR, "jobs.jsonl");

export type JobRecord = {
  ts: string;
  templateId: string;
  /** SHA-256 of the logo source — correlates jobs without storing artwork. */
  logoHash: string;
  outWidth: number;
  outHeight: number;
  renderMs: number;
  /** Phase 3+: money paid to external providers for this job (USD). */
  externalCostUsd: number;
  /** Phase 3+: automatic retries consumed by this job. */
  retries: number;
  ok: boolean;
  error?: string;
};

export function hashLogoSource(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}

export async function appendJob(record: JobRecord): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Metering must never break rendering; dev fs hiccups are acceptable here.
  }
}

/** Aggregate the JSONL log per template (unit-cost view for pricing work). */
export async function summarizeJobs(): Promise<JobsSummary> {
  let lines: string[];
  try {
    lines = (await readFile(LOG_FILE, "utf8")).split("\n").filter(Boolean);
  } catch {
    return { totalJobs: 0, byTemplate: [] };
  }

  const acc = new Map<string, { jobs: number; failures: number; sumMs: number; maxMs: number; cost: number }>();
  for (const line of lines) {
    let rec: JobRecord;
    try {
      rec = JSON.parse(line) as JobRecord;
    } catch {
      continue;
    }
    const a = acc.get(rec.templateId) ?? { jobs: 0, failures: 0, sumMs: 0, maxMs: 0, cost: 0 };
    a.jobs++;
    if (!rec.ok) a.failures++;
    a.sumMs += rec.renderMs;
    a.maxMs = Math.max(a.maxMs, rec.renderMs);
    a.cost += rec.externalCostUsd;
    acc.set(rec.templateId, a);
  }

  const byTemplate = [...acc.entries()]
    .map(([templateId, a]) => ({
      templateId,
      jobs: a.jobs,
      failures: a.failures,
      avgRenderMs: Math.round(a.sumMs / a.jobs),
      maxRenderMs: Math.round(a.maxMs),
      totalExternalCostUsd: a.cost,
    }))
    .sort((x, y) => x.templateId.localeCompare(y.templateId));

  return { totalJobs: lines.length, byTemplate };
}
