// GET: per-template cost aggregates from the job log (pricing groundwork).

import { summarizeJobs } from "@/labs/workflow/engine/job-log";
import { guardLabsRequest } from "@/lib/labs-access";

export async function GET(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  return Response.json(await summarizeJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
