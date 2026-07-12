// Generation job log — cost metering + audit trail + the success-rate
// dataset the requirement doc calls 製品の資産 (every generation is recorded
// with its template, engine, dials and prompt so per-template/per-engine
// analysis is a query, not a project). Phase E2 adds the deviation scores
// to this same record shape.
//
// Audit requirement (基盤要件書・横断): `logoSentTo` records which external
// API received the logo raster and when. Mock runs record null — the logo
// never left this server.

import path from "node:path";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import type { Dials, EngineParams } from "@/labs/generative/core/expression-format";
import type { PresetId } from "@/labs/generative/core/dials";
import type {
  GenEngineAggregate,
  GenJobsSummary,
  GenTemplateAggregate,
  RecentGenJob,
} from "@/labs/generative/core/api-types";
import { outputUrl } from "./storage";

const LOG_DIR = path.join(process.cwd(), "var", "generative-lab");
const LOG_FILE = path.join(LOG_DIR, "jobs.jsonl");
const RECENT_LIMIT = 12;

export type GenJobRecord = {
  ts: string;
  jobId: string;
  templateId: string;
  taxonomy: string;
  engineRequested: string;
  engineUsed: string;
  mock: boolean;
  preset: PresetId;
  dials: Dials;
  params: EngineParams;
  /** SHA-256 prefix of the logo source — correlates jobs, never the artwork. */
  logoHash: string;
  /** Audit: external API the logo raster was sent to (null = stayed local). */
  logoSentTo: string | null;
  /** The exact prompt sent — the成功率分析 dataset needs it verbatim. */
  prompt: string;
  outWidth: number;
  outHeight: number;
  genMs: number;
  costUsd: number;
  retries: number;
  ok: boolean;
  error?: string;
  outputFile?: string;
};

export function hashLogoSource(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}

export function newJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function appendGenJob(record: GenJobRecord): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Metering must never break generation; dev fs hiccups are acceptable.
  }
}

export async function summarizeGenJobs(): Promise<GenJobsSummary> {
  let lines: string[];
  try {
    lines = (await readFile(LOG_FILE, "utf8")).split("\n").filter(Boolean);
  } catch {
    return { totalJobs: 0, totalCostUsd: 0, byTemplate: [], byEngine: [], recent: [] };
  }

  const byTemplate = new Map<string, { jobs: number; failures: number; sumMs: number; cost: number }>();
  const byEngine = new Map<string, { jobs: number; failures: number; cost: number }>();
  const recent: RecentGenJob[] = [];
  let totalCostUsd = 0;

  for (const line of lines) {
    let rec: GenJobRecord;
    try {
      rec = JSON.parse(line) as GenJobRecord;
    } catch {
      continue;
    }
    totalCostUsd += rec.costUsd;

    const t = byTemplate.get(rec.templateId) ?? { jobs: 0, failures: 0, sumMs: 0, cost: 0 };
    t.jobs++;
    if (!rec.ok) t.failures++;
    t.sumMs += rec.genMs;
    t.cost += rec.costUsd;
    byTemplate.set(rec.templateId, t);

    const engineKey = rec.mock ? `${rec.engineRequested}→mock` : rec.engineUsed;
    const e = byEngine.get(engineKey) ?? { jobs: 0, failures: 0, cost: 0 };
    e.jobs++;
    if (!rec.ok) e.failures++;
    e.cost += rec.costUsd;
    byEngine.set(engineKey, e);

    if (rec.ok && rec.outputFile) {
      recent.push({
        jobId: rec.jobId,
        ts: rec.ts,
        templateId: rec.templateId,
        engineUsed: rec.engineUsed,
        mock: rec.mock,
        preset: rec.preset,
        costUsd: rec.costUsd,
        outputUrl: outputUrl(rec.outputFile),
      });
    }
  }

  const templates: GenTemplateAggregate[] = [...byTemplate.entries()]
    .map(([templateId, a]) => ({
      templateId,
      jobs: a.jobs,
      failures: a.failures,
      avgGenMs: Math.round(a.sumMs / a.jobs),
      totalCostUsd: a.cost,
    }))
    .sort((x, y) => x.templateId.localeCompare(y.templateId));

  const engines: GenEngineAggregate[] = [...byEngine.entries()]
    .map(([engine, a]) => ({
      engine,
      jobs: a.jobs,
      failures: a.failures,
      totalCostUsd: a.cost,
    }))
    .sort((x, y) => x.engine.localeCompare(y.engine));

  return {
    totalJobs: lines.length,
    totalCostUsd,
    byTemplate: templates,
    byEngine: engines,
    recent: recent.slice(-RECENT_LIMIT).reverse(),
  };
}
