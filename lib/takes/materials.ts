import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getR2Object } from "@/lib/r2";

// Briefs hold a material reference, never a private R2 key. The take_inputs
// row pins the exact material version consumed by that take; this resolver
// checks that relationship before a renderer receives the bytes.
const MATERIAL_URI_PREFIX = "material:";

export const materialUri = (materialId: string): string => `${MATERIAL_URI_PREFIX}${materialId}`;

type InputRow = {
  material_id: string;
  // Supabase's relationship inference represents this join as an array even
  // though the foreign key is one material per input; direct clients can
  // return the object form. Support both at this boundary.
  brand_materials: { r2_key: string | null } | Array<{ r2_key: string | null }> | null;
};

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

  const { data, error } = await supabase
    .from("take_inputs")
    .select("material_id, brand_materials(r2_key)")
    .eq("take_id", takeId)
    .in("material_id", [...ids]);
  if (error) throw new Error(`入力素材を読めませんでした: ${error.message}`);

  const inputs = new Map<string, InputRow>();
  for (const row of (data ?? []) as InputRow[]) inputs.set(row.material_id, row);

  const resolved = new Map<string, string>();
  for (const id of ids) {
    const input = inputs.get(id);
    const material = input?.brand_materials;
    const key = (Array.isArray(material) ? material[0] : material)?.r2_key;
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

  return replaceMaterialUris(brief, resolved);
}

function collectMaterialIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (typeof value === "string" && value.startsWith(MATERIAL_URI_PREFIX)) {
    ids.add(value.slice(MATERIAL_URI_PREFIX.length));
  } else if (Array.isArray(value)) {
    for (const item of value) collectMaterialIds(item, ids);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectMaterialIds(item, ids);
  }
  return ids;
}

function replaceMaterialUris<T>(value: T, resolved: ReadonlyMap<string, string>): T {
  if (typeof value === "string" && value.startsWith(MATERIAL_URI_PREFIX)) {
    const id = value.slice(MATERIAL_URI_PREFIX.length);
    const path = resolved.get(id);
    if (!path) throw new Error(`素材を解決できませんでした: ${id}`);
    return path as T;
  }
  if (Array.isArray(value)) return value.map((item) => replaceMaterialUris(item, resolved)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceMaterialUris(item, resolved)]),
    ) as T;
  }
  return value;
}
