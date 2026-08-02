import { guardLabsRequest } from "@/lib/labs-access";
import { persistCampaignCatalog } from "@/lib/campaign/catalog";
import {
  listCampaignJobsForUser,
  saveCampaignCatalog,
} from "@/lib/campaign/jobs";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * One-way bridge for Campaign Lab jobs created before the canonical brand
 * catalog existed. It is intentionally idempotent at the job level: a job
 * with a catalog link is never imported again.
 */
export async function POST(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const user = await requireUser(req);

  const jobs = listCampaignJobsForUser(user.id).filter(
    (job) => job.status === "done" && job.kit && !job.catalog,
  );
  const migrated: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  // Keep this sequential: legacy runs often describe the same business, and
  // serial persistence lets the later run reuse the hierarchy/logo created by
  // the first instead of racing to create duplicates.
  for (const job of jobs) {
    try {
      const catalog = await persistCampaignCatalog({
        accessToken: user.token,
        userId: user.id,
        job,
        kit: job.kit!,
      });
      saveCampaignCatalog(job.id, catalog);
      migrated.push(job.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ブランド台帳へ移行できませんでした";
      saveCampaignCatalog(job.id, { error: message });
      failures.push({ id: job.id, error: message });
    }
  }

  return Response.json(
    { migrated, failures },
    {
      status: failures.length > 0 && migrated.length === 0 ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
