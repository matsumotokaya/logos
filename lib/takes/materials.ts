import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getR2Object } from "@/lib/r2";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import {
  collectMaterialIds,
  materialUri,
  replaceMaterialUris,
  takeMaterialSignatureToken,
} from "./material-uri";

// Briefs hold a material reference, never a private R2 key. The take_inputs
// row pins the exact material version consumed by that take; the resolvers
// below check that relationship before anyone receives the bytes.
//
// Two resolvers, one relationship:
//   stageBriefMaterials    — render time. Downloads the bytes next to the
//                            composition, and fails loudly on a missing pin.
//   resolveBriefMaterialUrls — preview time. Mints signed same-origin URLs the
//                            browser can fetch, and reports what it could not
//                            resolve instead of throwing, so the rest of the
//                            page still renders.

export { materialUri };

type InputRow = {
  material_id: string;
  // Supabase's relationship inference represents this join as an array even
  // though the foreign key is one material per input; direct clients can
  // return the object form. Support both at this boundary.
  brand_materials: { r2_key: string | null } | Array<{ r2_key: string | null }> | null;
};

function r2KeyOf(input: InputRow | undefined): string | null {
  const material = input?.brand_materials;
  return (Array.isArray(material) ? material[0] : material)?.r2_key ?? null;
}

async function pinnedInputs(
  supabase: SupabaseClient,
  takeId: string,
  ids: ReadonlySet<string>,
): Promise<Map<string, InputRow>> {
  const { data, error } = await supabase
    .from("take_inputs")
    .select("material_id, brand_materials(r2_key)")
    .eq("take_id", takeId)
    .in("material_id", [...ids]);
  if (error) throw new Error(`入力素材を読めませんでした: ${error.message}`);

  const inputs = new Map<string, InputRow>();
  for (const row of (data ?? []) as InputRow[]) inputs.set(row.material_id, row);
  return inputs;
}

/**
 * Replace material:<uuid> leaves in a brief with staticFile-compatible paths,
 * downloading only the pinned inputs to a renderer-owned temporary public
 * directory. Other strings (including old staticFile paths) remain untouched
 * so existing takes continue to render while being ported.
 */
export async function stageBriefMaterials<T>(
  supabase: SupabaseClient,
  takeId: string,
  brief: T,
  publicDir: string,
): Promise<T> {
  const ids = collectMaterialIds(brief);
  if (ids.size === 0) return brief;

  const inputs = await pinnedInputs(supabase, takeId, ids);

  const resolved = new Map<string, string>();
  for (const id of ids) {
    const key = r2KeyOf(inputs.get(id));
    if (!key) throw new Error(`テイクに固定されていない素材です: ${id}`);

    const bytes = await getR2Object(key);
    if (!bytes) throw new Error(`R2に素材がありません: ${id}`);

    // Both the identifier and basename are controlled by our DB/key format;
    // basename also preserves the extension that Remotion uses to decode it.
    const name = path.basename(key);
    const relative = path.posix.join("materials", id, name);
    const destination = path.join(publicDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    resolved.set(id, relative);
  }

  return replaceMaterialUris(brief, (id) => {
    const staged = resolved.get(id);
    if (!staged) throw new Error(`素材を解決できませんでした: ${id}`);
    return staged;
  });
}

/**
 * Replace material:<uuid> leaves with signed same-origin URLs.
 *
 * The browser preview runs the same composition the renderer does, but it has
 * no filesystem to stage bytes into and cannot attach an Authorization header
 * to an <img>/<audio> request. So the server — which has already checked the
 * caller's access to this take through RLS — hands the client URLs that carry
 * their own proof. The composition accepts any "/..." or "http..." src
 * (remotion/event/EventComposition.tsx), so no template change is needed.
 *
 * Unresolvable references are left as-is and returned in `unresolved`: the
 * caller decides how to say "this material is not pinned to this take", which
 * is a data problem, not a designed fallback.
 */
export async function resolveBriefMaterialUrls<T>(
  supabase: SupabaseClient,
  brandId: string,
  takeId: string,
  brief: T,
): Promise<{ brief: T; unresolved: string[] }> {
  const ids = collectMaterialIds(brief);
  if (ids.size === 0) return { brief, unresolved: [] };

  const inputs = await pinnedInputs(supabase, takeId, ids);

  const unresolved: string[] = [];
  const resolved = replaceMaterialUris(brief, (id) => {
    const key = r2KeyOf(inputs.get(id));
    if (!key) {
      unresolved.push(id);
      return null;
    }
    // Same shape the renderer stages to (materials/<id>/<name>): the last
    // segment is the real filename, so the slot list stays readable and media
    // players get the extension they expect.
    const name = encodeURIComponent(path.posix.basename(key));
    return signedLabsUrl(
      `/api/brands/${brandId}/takes/${takeId}/materials/${id}/${name}?key=${encodeURIComponent(key)}`,
      takeMaterialSignatureToken(brandId, takeId, id, key),
    );
  });

  return { brief: resolved, unresolved };
}
