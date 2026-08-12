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
  /** What a person choosing between tracks reads. */
  label: string;
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
    id: "bgm-bright-corporate",
    kind: "bgm",
    src: "defaults/bgm/bright-corporate.mp3",
    tone: "ink",
    label: "明るい（コーポレート）",
    credit: "仮素材（製品紹介動画で使っていたBGM）",
    licensed: false,
  },
  {
    id: "bgm-ink-cinematic",
    kind: "bgm",
    src: "defaults/bgm/ink-cinematic.mp3",
    tone: "ink",
    label: "和モダン（重厚）",
    credit: "仮素材（レオパレス21×WealthPark Lab 案件の支給BGM）",
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
 * The default of a kind: the first entry that matches.
 *
 * Ordering is the decision, and it is deliberately not varied per take. An
 * earlier version picked from a stable hash of the take id so different films
 * got different tracks — which is a nice property and the wrong one. A default
 * that differs between two videos of the same brand is not a default; it is a
 * surprise. Variety is what the picker is for, once a user cares.
 */
export const defaultAsset = (
  kind: DefaultAssetKind,
  tone: string,
): DefaultAsset | null => defaultsOfKind(kind, tone)[0] ?? null;

/** Defaults that may not be published — the publish warning lists these. */
export const unlicensedDefaults = (srcs: readonly string[]): DefaultAsset[] =>
  DEFAULT_ASSETS.filter((asset) => !asset.licensed && srcs.includes(asset.src));
