// The default asset pool.
//
// A seeded deliverable is dressed from here: the BGM, the ink art behind a
// title, the texture on a ground, the b-roll under a scene. None of it belongs
// to the brand, all of it is recorded as `inferred`, and every slot it fills
// is one the user can replace with their own material.
//
// The point of the pool is that it compounds. A template declares the KINDS of
// asset its slots take; enriching the pool with better tracks and better
// footage improves every default film at once, with no template change. So the
// catalog is a list of files with tone and format, not a per-template mapping.
//
// Slots that the pool cannot fill are not a failure: the event templates ship
// designed fallbacks for every visual slot (an ink ground and gold particles
// where a photo would be), so an empty pool still produces a finished film.
// That is why this can start nearly bare and grow.

export const ASSET_KINDS = ["bgm", "ink_art", "texture", "b_roll", "still"] as const;
export type DefaultAssetKind = (typeof ASSET_KINDS)[number];

export interface DefaultAsset {
  id: string;
  kind: DefaultAssetKind;
  /** Path under public/, served as a same-origin static file. */
  src: string;
  /** Art-direction family. Templates ask for a tone, not a file. */
  tone: string;
  /** Shown when a user asks where a default came from. */
  credit: string;
  /**
   * Whether this may be published. Anything without a licence that permits
   * commercial redistribution is usable as a placeholder and blocked at
   * publish, so an unlicensed track can never leave the building inside an
   * exported MP4.
   */
  licensed: boolean;
}

/**
 * Music is the first thing the pool carries, because it is the first thing a
 * user will not supply. Nobody uploads a soundtrack; they expect one.
 *
 * Both tracks below are client-supplied placeholders — they were licensed for
 * one production, not for redistribution — so `licensed: false` keeps them out
 * of an exported MP4 while they still dress every preview. The bytes are
 * gitignored for the same reason the event photography is; the catalog entry
 * naming them is committed, so a fresh checkout knows what is missing.
 *
 * Replacing these with cleared tracks is a content task, not a code change.
 */
export const DEFAULT_ASSETS: DefaultAsset[] = [
  {
    id: "bgm-ink-cinematic",
    kind: "bgm",
    src: "defaults/bgm/ink-cinematic.mp3",
    tone: "ink",
    credit: "仮素材（レオパレス21×WealthPark Lab 案件の支給BGM）",
    licensed: false,
  },
  {
    id: "bgm-bright-corporate",
    kind: "bgm",
    src: "defaults/bgm/bright-corporate.mp3",
    tone: "ink",
    credit: "仮素材（CM Makerのサンプル用BGM）",
    licensed: false,
  },
];

export const defaultsOfKind = (
  kind: DefaultAssetKind,
  tone?: string,
): DefaultAsset[] =>
  DEFAULT_ASSETS.filter(
    (asset) => asset.kind === kind && (tone === undefined || asset.tone === tone),
  );

/**
 * Pick one default of a kind, stably.
 *
 * Stable rather than random because a take that renders twice must render the
 * same film: `seed` is the take's own identity, so two brands get different
 * tracks and one brand gets the same track every time. Random selection would
 * make a re-render a different video with no input having changed, which is
 * the same disease as an unstable fingerprint (§16 Phase 2-7).
 */
export function pickDefault(
  kind: DefaultAssetKind,
  tone: string,
  seed: string,
): DefaultAsset | null {
  const candidates = defaultsOfKind(kind, tone);
  if (candidates.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  return candidates[hash % candidates.length];
}

/** Defaults that may not be published — the publish warning lists these. */
export const unlicensedDefaults = (srcs: readonly string[]): DefaultAsset[] =>
  DEFAULT_ASSETS.filter((asset) => !asset.licensed && srcs.includes(asset.src));
