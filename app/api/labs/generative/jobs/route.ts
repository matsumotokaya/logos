// GET: cost + success-rate aggregation from the generation job log.

import { summarizeGenJobs } from "@/labs/generative/engine/job-log";

export async function GET() {
  return Response.json(await summarizeGenJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
