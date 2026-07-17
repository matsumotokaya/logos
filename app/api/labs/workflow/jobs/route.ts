// GET: per-template cost aggregates from the job log (pricing groundwork).

import { summarizeJobs } from "@/labs/workflow/engine/job-log";
import { labsDisabledResponse, labsEnabled } from "@/lib/labs-access";

export async function GET() {
  if (!labsEnabled()) return labsDisabledResponse();
  return Response.json(await summarizeJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
