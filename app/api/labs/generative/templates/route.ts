// GET: expression-template catalog + engine availability. Broken templates
// are returned with their validation errors (designer feedback loop).

import { listExpressionTemplates } from "@/labs/generative/engine/registry";
import { engineStatuses } from "@/labs/generative/engine/providers";
import type { CatalogResponse } from "@/labs/generative/core/api-types";
import { guardLabsRequest } from "@/lib/labs-access";

export async function GET(req: Request) {
  const denied = await guardLabsRequest(req);
  if (denied) return denied;
  const body: CatalogResponse = {
    engines: engineStatuses(),
    templates: await listExpressionTemplates(),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
