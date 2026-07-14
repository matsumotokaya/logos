import { listTemplates } from "@/labs/workflow/engine/registry";
import { buildPresentationCatalog } from "@/lib/presentation-catalog";

export async function GET() {
  const templates = await listTemplates();
  return Response.json(buildPresentationCatalog(templates), {
    headers: { "Cache-Control": "no-store" },
  });
}
