// GET: the validated template catalog. Broken templates are returned with
// their errors so the lab UI can show designers what to fix.

import { listTemplates } from "@/labs/workflow/engine/registry";
import { guardLabsRequest } from "@/lib/labs-access";

export async function GET(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const templates = await listTemplates();
  return Response.json(
    { templates },
    { headers: { "Cache-Control": "no-store" } },
  );
}
