import "server-only";

import { LABS_PLATFORM_ROLES } from "@/lib/platform-roles";
import {
  createServerSupabaseForToken,
  requireUser,
} from "@/lib/supabase/server";

// Labs are internal R&D surfaces (see labs/README.md). In production they
// stay hidden unless the deployment explicitly opts in with LABS_ENABLED=1;
// development always has them. Prod-facing endpoints that presentations
// depend on (workflow compose, workflow runs) must NOT use this gate.
export function labsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.LABS_ENABLED === "1"
  );
}

export function labsDisabledResponse(): Response {
  return Response.json({ error: "Not found." }, { status: 404 });
}

/**
 * Protect a Labs-only Route Handler. Returning 404 keeps the internal surface
 * undiscoverable; database/configuration failures remain visible as 500s.
 */
export async function guardLabsRequest(req: Request): Promise<Response | null> {
  if (!labsEnabled()) return labsDisabledResponse();

  let user;
  try {
    user = await requireUser(req);
  } catch {
    return labsDisabledResponse();
  }
  if (user.isAnonymous) return labsDisabledResponse();

  const supabase = createServerSupabaseForToken(user.token);
  const { data, error } = await supabase
    .from("platform_role_assignments")
    .select("role")
    .eq("user_id", user.id)
    .in("role", [...LABS_PLATFORM_ROLES]);

  if (error) {
    console.error("Failed to verify Labs platform role:", error.message);
    return Response.json(
      { error: "Labs access could not be verified." },
      { status: 500 },
    );
  }

  return data && data.length > 0 ? null : labsDisabledResponse();
}
