import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CampaignBrandKit } from "./schema";
import type { PipelineProgress, LlmUsageSummary } from "./pipeline";
import type { BrandMatchJudgment } from "./creative";

// Campaign job store — generation runs server-side detached from the HTTP
// request, so closing the tab or losing the connection never loses the run:
// the UI re-attaches by polling the persisted record. Lab phase persists to
// var/campaign-lab/ on the local disk; Phase 1 moves this to a `campaigns`
// table + R2 (see labs/campaign/README.md roadmap).

export interface CampaignJobMeta {
  captured: boolean;
  adjudicated: boolean;
  verification: (BrandMatchJudgment & { retried: boolean }) | null;
  /** LLM API cost of this run (absent on records from before cost tracking). */
  usage?: LlmUsageSummary | null;
}

export interface CampaignJobStep extends PipelineProgress {
  ts: string; // ISO timestamp
}

export interface CampaignJob {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: "running" | "done" | "error";
  input: { url: string | null; name: string | null; files: number; hasText: boolean };
  steps: CampaignJobStep[];
  kit: CampaignBrandKit | null;
  meta: CampaignJobMeta | null;
  error: string | null;
}

const JOBS_DIR = path.join(process.cwd(), "var", "campaign-lab", "jobs");

function jobPath(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`);
}
function htmlPath(id: string): string {
  return path.join(JOBS_DIR, `${id}.html`);
}

function writeJob(job: CampaignJob): void {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(jobPath(job.id), JSON.stringify(job));
}

const SAFE_ID = /^[a-f0-9-]{36}$/;

export function createCampaignJob(
  userId: string,
  input: CampaignJob["input"]
): CampaignJob {
  const now = new Date().toISOString();
  const job: CampaignJob = {
    id: randomUUID(),
    userId,
    createdAt: now,
    updatedAt: now,
    status: "running",
    input,
    steps: [],
    kit: null,
    meta: null,
    error: null,
  };
  writeJob(job);
  return job;
}

export function appendCampaignStep(id: string, step: PipelineProgress): void {
  const job = getCampaignJob(id);
  if (!job) return;
  job.steps.push({ ...step, ts: new Date().toISOString() });
  writeJob(job);
}

export function completeCampaignJob(
  id: string,
  result: { kit: CampaignBrandKit; meta: CampaignJobMeta; html: string }
): void {
  const job = getCampaignJob(id);
  if (!job) return;
  job.status = "done";
  job.kit = result.kit;
  job.meta = result.meta;
  fs.writeFileSync(htmlPath(id), result.html);
  writeJob(job);
}

export function failCampaignJob(id: string, error: string): void {
  const job = getCampaignJob(id);
  if (!job) return;
  job.status = "error";
  job.error = error;
  writeJob(job);
}

export function getCampaignJob(id: string): CampaignJob | null {
  if (!SAFE_ID.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(jobPath(id), "utf8")) as CampaignJob;
  } catch {
    return null;
  }
}

export function readCampaignJobHtml(id: string): string | null {
  if (!SAFE_ID.test(id)) return null;
  try {
    return fs.readFileSync(htmlPath(id), "utf8");
  } catch {
    return null;
  }
}

/** Most recent job for a user (reload/reconnect recovery). */
export function latestCampaignJobForUser(userId: string): CampaignJob | null {
  let latest: CampaignJob | null = null;
  try {
    for (const f of fs.readdirSync(JOBS_DIR)) {
      if (!f.endsWith(".json")) continue;
      try {
        const job = JSON.parse(
          fs.readFileSync(path.join(JOBS_DIR, f), "utf8")
        ) as CampaignJob;
        if (job.userId !== userId) continue;
        if (!latest || job.createdAt > latest.createdAt) latest = job;
      } catch {
        // skip unreadable records
      }
    }
  } catch {
    return null; // dir doesn't exist yet
  }
  return latest;
}
