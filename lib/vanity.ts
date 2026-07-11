// Vanity URL resolution: /[handle]/[slug] → canonical logo id (docs/account-design.md §2).
// Handles and public logos are world-readable under RLS, so no session is needed.

import { hasSupabase, supabase } from "@/lib/supabase/client";

export async function resolveVanity(
  handle: string,
  slug: string
): Promise<string | null> {
  if (!hasSupabase) return null;

  const { data: owner } = await supabase
    .from("handles")
    .select("user_id, org_id")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!owner) return null;

  let query = supabase
    .from("logos")
    .select("id")
    .eq("slug", slug.toLowerCase())
    .eq("visibility", "public");
  query = owner.org_id
    ? query.eq("owner_org_id", owner.org_id)
    : query.eq("owner_user_id", owner.user_id);
  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}
