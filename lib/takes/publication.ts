import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalTakePath, canonicalVideoPath } from "./publication-path";

/** Publish one render at its stable Take URL. Retries and concurrent inserts
 * resolve to the same live row; a different render occupying the path fails. */
export async function ensureCanonicalPublication(
  supabase: SupabaseClient,
  input: {
    takeId: string;
    renderId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: true; urlPath: string } | { ok: false; error: string }> {
  return ensurePublication(supabase, {
    ...input,
    urlPath: canonicalTakePath(input.takeId),
  });
}

export async function ensureCanonicalVideoPublication(
  supabase: SupabaseClient,
  input: {
    takeId: string;
    renderId: string;
    userId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: true; urlPath: string } | { ok: false; error: string }> {
  return ensurePublication(supabase, {
    ...input,
    urlPath: canonicalVideoPath(input.takeId),
  });
}

async function ensurePublication(
  supabase: SupabaseClient,
  input: {
    renderId: string;
    userId: string;
    urlPath: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: true; urlPath: string } | { ok: false; error: string }> {
  const urlPath = input.urlPath;
  const read = async () =>
    supabase
      .from("publications")
      .select("render_id")
      .eq("surface", "canonical_url")
      .eq("url_path", urlPath)
      .eq("status", "live")
      .maybeSingle();

  const current = await read();
  if (current.error) return { ok: false, error: current.error.message };
  if (current.data) {
    return current.data.render_id === input.renderId
      ? { ok: true, urlPath }
      : { ok: false, error: "同じ公開URLが別のRenderに使われています" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("publications").insert({
    render_id: input.renderId,
    surface: "canonical_url",
    url_path: urlPath,
    status: "live",
    published_at: now,
    published_by: input.userId,
    metadata: input.metadata ?? {},
  });
  if (!error) return { ok: true, urlPath };

  if (error.code === "23505") {
    const raced = await read();
    if (!raced.error && raced.data?.render_id === input.renderId) {
      return { ok: true, urlPath };
    }
  }
  return { ok: false, error: error.message };
}

/** Retire rather than delete so publication history remains auditable. */
export async function retireCanonicalPublications(
  supabase: SupabaseClient,
  renderIds: string[],
): Promise<{ ok: true; retired: number } | { ok: false; error: string }> {
  if (renderIds.length === 0) return { ok: true, retired: 0 };
  const { data, error } = await supabase
    .from("publications")
    .update({ status: "retired", updated_at: new Date().toISOString() })
    .in("render_id", renderIds)
    .eq("surface", "canonical_url")
    .eq("status", "live")
    .select("id");
  return error
    ? { ok: false, error: error.message }
    : { ok: true, retired: data?.length ?? 0 };
}
