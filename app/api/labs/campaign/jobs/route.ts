// GET: poll a campaign job (?id=...) or fetch the caller's latest job.
//
// This is how the UI re-attaches to a run after reload / connection loss:
// the whole progress log, the Brand Kit and the rendered LP live in the job
// store, not in the original request. Done jobs include the LP html (for the
// inline hero digest) and a signed URL for opening the real page in a new tab.

import { guardLabsRequest } from "@/lib/labs-access";
import { requireUser } from "@/lib/supabase/server";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import {
  getCampaignJob,
  latestCampaignJobForUser,
  listCampaignJobsForUser,
  readCampaignJobHtml,
  type CampaignJob,
} from "@/lib/campaign/jobs";

function jobResponse(job: CampaignJob) {
  const done = job.status === "done";
  return Response.json(
    {
      job,
      html: done ? readCampaignJobHtml(job.id) : null,
      lpUrl: done
        ? signedLabsUrl(`/c/${job.id}`, `campaign-lp:${job.id}`)
        : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);

  const search = new URL(req.url).searchParams;

  // ?list=1 — card summaries for /campaigns (no step logs / HTML payloads).
  if (search.get("list")) {
    const jobs = listCampaignJobsForUser(user.id).map((job) => ({
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
      name: job.kit?.service.name ?? job.input.name ?? job.input.url ?? "無題",
      tagline: job.kit?.service.tagline ?? null,
      primary: job.kit?.brand.primary ?? null,
      accent: job.kit?.brand.accent ?? null,
    }));
    return Response.json({ jobs }, { headers: { "Cache-Control": "no-store" } });
  }

  const id = search.get("id");
  if (id) {
    const job = getCampaignJob(id);
    if (!job || job.userId !== user.id)
      return Response.json({ error: "ジョブが見つかりません" }, { status: 404 });
    return jobResponse(job);
  }

  const latest = latestCampaignJobForUser(user.id);
  if (!latest) return Response.json({ job: null }, { headers: { "Cache-Control": "no-store" } });
  return jobResponse(latest);
}
