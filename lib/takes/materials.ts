import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getR2Object } from "@/lib/r2";
import { signedLabsUrl } from "@/lib/labs-output-sign";
import { uniqueMaterialPaths, type NameableMaterial } from "@/lib/materials/naming";
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

/** Everything staging needs: the bytes' address, and how to name them. */
type MaterialRow = NameableMaterial & { r2_key: string | null };

type InputRow = {
  material_id: string;
  // Supabase's relationship inference represents this join as an array even
  // though the foreign key is one material per input; direct clients can
  // return the object form. Support both at this boundary.
  brand_materials: MaterialRow | MaterialRow[] | null;
};

const materialOf = (input: InputRow | undefined): MaterialRow | null => {
  const material = input?.brand_materials;
  return (Array.isArray(material) ? material[0] : material) ?? null;
};

const r2KeyOf = (input: InputRow | undefined): string | null =>
  materialOf(input)?.r2_key ?? null;

async function pinnedInputs(
  supabase: SupabaseClient,
  takeId: string,
  ids: ReadonlySet<string>,
): Promise<Map<string, InputRow>> {
  const { data, error } = await supabase
    .from("take_inputs")
    .select(
      "material_id, brand_materials(r2_key, label, kind, category, media_type, width, opaque, luminance, source_kind)",
    )
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

  // Named the way the inventory names them, so the project that unpacks on
  // somebody else's machine has the same organisation the screen showed
  // (docs/asset-normalization.md §10). It used to stage
  // `materials/<uuid>/<checksum>` — a directory named after a database id
  // holding a file with no extension — which is unreadable to the one person
  // the export exists for.
  const rows = [...ids].map((id) => {
    const material = materialOf(inputs.get(id));
    if (!material?.r2_key) throw new Error(`テイクに固定されていない素材です: ${id}`);
    return { id, ...material };
  });
  const paths = uniqueMaterialPaths(rows);

  const resolved = new Map<string, string>();
  for (const row of rows) {
    const bytes = await getR2Object(row.r2_key as string);
    if (!bytes) throw new Error(`R2に素材がありません: ${row.id}`);

    const relative = paths.get(row.id) as string;
    const destination = path.join(publicDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    resolved.set(row.id, relative);
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
): Promise<{ brief: T; unresolved: string[]; urls: Record<string, string> }> {
  const ids = collectMaterialIds(brief);
  if (ids.size === 0) return { brief, unresolved: [], urls: {} };

  const inputs = await pinnedInputs(supabase, takeId, ids);

  const unresolved: string[] = [];
  // What each pointer became.
  //
  // The client needs this to read its own brief back: a screen that lets you
  // *choose* a material compares the brief's value against `material:<id>`, and
  // after this function ran there is no such string left in it. The BGM picker
  // highlighted nothing for exactly that reason — every option compared unequal
  // to a signed URL. Handing back the mapping lets the caller invert it instead
  // of pattern-matching a URL.
  const urls: Record<string, string> = {};
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
    const url = signedLabsUrl(
      `/api/brands/${brandId}/takes/${takeId}/materials/${id}/${name}?key=${encodeURIComponent(key)}`,
      takeMaterialSignatureToken(brandId, takeId, id, key),
    );
    urls[materialUri(id)] = url;
    return url;
  });

  return { brief: resolved, unresolved, urls };
}
