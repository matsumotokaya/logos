// GET: the validated template catalog. Broken templates are returned with
// their errors so the lab UI can show designers what to fix.

import { listTemplates } from "@/labs/image/engine/registry";

export async function GET() {
  const templates = await listTemplates();
  return Response.json(
    { templates },
    { headers: { "Cache-Control": "no-store" } },
  );
}
