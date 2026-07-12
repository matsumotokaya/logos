// GET: per-template cost aggregates from the job log (pricing groundwork).

import { summarizeJobs } from "@/labs/workflow/engine/job-log";

export async function GET() {
  return Response.json(await summarizeJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
