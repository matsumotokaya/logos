// How a brief points at a material, and how those pointers are walked.
//
// A brief never holds a private R2 key: it holds `material:<uuid>`, and the
// take_inputs row pins which material version that take consumes. Two consumers
// resolve those pointers and they must walk the brief identically:
//
//   render time — materials.ts downloads the bytes next to the composition
//   preview time — materials.ts mints signed same-origin URLs for the browser
//
// The walk lives here, free of `server-only`, so it can be tested directly.

export const MATERIAL_URI_PREFIX = "material:";

export const materialUri = (materialId: string): string =>
  `${MATERIAL_URI_PREFIX}${materialId}`;

/** Signature payload for one material served to a header-less browser
 *  request: the route identity plus the exact object it may serve. */
export const takeMaterialSignatureToken = (
  brandId: string,
  takeId: string,
  materialId: string,
  key: string,
): string => `take-material:${brandId}:${takeId}:${materialId}:${key}`;

export function collectMaterialIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (typeof value === "string" && value.startsWith(MATERIAL_URI_PREFIX)) {
    ids.add(value.slice(MATERIAL_URI_PREFIX.length));
  } else if (Array.isArray(value)) {
    for (const item of value) collectMaterialIds(item, ids);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectMaterialIds(item, ids);
  }
  return ids;
}

/**
 * Rewrite every `material:<uuid>` leaf through `resolve`.
 *
 * Returning null from `resolve` leaves the pointer untouched, so an unresolved
 * material stays visible as itself instead of turning into an empty slot — an
 * empty slot means "the template designed a substitute" (deliverable
 * architecture §17), which is not what a missing pin is.
 */
export function replaceMaterialUris<T>(
  value: T,
  resolve: (materialId: string) => string | null,
): T {
  if (typeof value === "string" && value.startsWith(MATERIAL_URI_PREFIX)) {
    const resolved = resolve(value.slice(MATERIAL_URI_PREFIX.length));
    return (resolved ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceMaterialUris(item, resolve)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceMaterialUris(item, resolve)]),
    ) as T;
  }
  return value;
}
