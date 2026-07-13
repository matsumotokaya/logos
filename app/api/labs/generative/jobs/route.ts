// GET: cost + success-rate aggregation from the generation job log.
// With ?logo=<hash16>: that logo's successful runs (the logo-report data).

import { listRunsForLogo, summarizeGenJobs } from "@/labs/generative/engine/job-log";

export async function GET(req: Request) {
  const logo = new URL(req.url).searchParams.get("logo");
  if (logo !== null) {
    if (!/^[a-f0-9]{16}$/.test(logo))
      return Response.json({ error: "logo: 16桁の16進ハッシュが必要" }, { status: 400 });
    return Response.json(await listRunsForLogo(logo), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json(await summarizeGenJobs(), {
    headers: { "Cache-Control": "no-store" },
  });
}
