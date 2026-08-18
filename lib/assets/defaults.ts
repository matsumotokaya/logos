// The default asset pool.
//
// A seeded deliverable is dressed from here: the BGM, the ink art behind a
// title, the texture on a ground, the b-roll under a scene. None of it belongs
// to the brand, all of it is recorded as `inferred`, and every slot it fills
// is one the user can replace with their own material.
//
// SOUND EFFECTS ARE POOLED SEPARATELY, on purpose. Music is chosen — one track
// per film, by a person, from a list they read. Effects are not: a template
// rings its own structure (lib/event-cm/sfx-cues.ts asks for a role and a
// presence, never for a file), so their catalog is generated at ingest with a
// measured level per file rather than hand-written here — see
// scripts/fetch-default-sfx.mjs and public/defaults/sfx/catalog.json. `sfx`
// stays in ASSET_KINDS so the two pools are one vocabulary the day somebody
// wants to swap a cue by hand.
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

export const ASSET_KINDS = ["bgm", "sfx", "ink_art", "texture", "b_roll", "still"] as const;
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
   * Whether this may be published.
   *
   * False marks a track that is fine for previewing and must not leave the
   * building inside an exported MP4. **The export does not enforce this yet** —
   * `unlicensedDefaults()` has no caller — so today it only drives what the
   * picker says. Every track in the pool is currently cleared, so nothing is at
   * risk; adding one that is not means writing the render-side exclusion first.
   */
  licensed: boolean;
}

/**
 * Music is the first thing the pool carries, because it is the first thing a
 * user will not supply. Nobody uploads a soundtrack; they expect one.
 *
 * Both tracks were generated with Suno AI on a paid plan that grants commercial
 * use, so they are ours to publish: they play in previews AND are burned into
 * exported MP4s (confirmed by the owner, 2026-08-15). They were previously
 * recorded here as client-supplied placeholders from the productions they were
 * first used in, which was wrong about where they came from and kept them out
 * of every export.
 *
 * The bytes are gitignored for the same reason the event photography is; the
 * catalog entry naming them is committed, so a fresh checkout knows what is
 * missing.
 *
 * `licensed: false` remains meaningful for the next track that arrives without
 * clearance — the export refuses it and the picker says so.
 */
export const DEFAULT_ASSETS: DefaultAsset[] = [
  {
    id: "bgm-bright-corporate",
    kind: "bgm",
    src: "defaults/bgm/bright-corporate.mp3",
    tone: "ink",
    label: "明るい（コーポレート）",
    credit: "Suno AI（商用利用可プランで生成）",
    licensed: true,
  },
  {
    id: "bgm-ink-cinematic",
    kind: "bgm",
    src: "defaults/bgm/ink-cinematic.mp3",
    tone: "ink",
    label: "和モダン（重厚）",
    credit: "Suno AI（商用利用可プランで生成）",
    licensed: true,
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

export const assetById = (id: string): DefaultAsset | null =>
  DEFAULT_ASSETS.find((asset) => asset.id === id) ?? null;

/**
 * The track a new take of this template opens with.
 *
 * The template names it (`TemplateEntry.defaultBgm`), because the kind of film
 * decides the music — an event promo and a product film want different tracks,
 * and that is not a fact about whoever is making one. Passing the id rather
 * than the whole entry keeps this module free of the catalog, which imports
 * nothing and must stay that way.
 *
 * A template that names no track, or names one the pool has lost, plays
 * silently. That is a designed state for these templates, not a hole — but it
 * is worth being unsurprised by, which is why nothing here falls back to
 * "some other track".
 */
export const templateBgm = (bgmId: string | undefined): DefaultAsset | null => {
  if (!bgmId) return null;
  const asset = assetById(bgmId);
  return asset?.kind === "bgm" ? asset : null;
};

/** Kinds a visual slot can be dressed with. Music is not one of them. */
const VISUAL_KINDS = new Set<DefaultAssetKind>(["still", "b_roll", "ink_art", "texture"]);

/**
 * The stock picture a template puts in one of its visual slots.
 *
 * Second tier of the ladder: the brand's own picture first, this next, the
 * composition's designed substitute last. Returns null for anything the pool
 * has lost or that is not a picture — a wrong-kind id must not put a music
 * file in a photo slot, and a missing one falls through to tier 3, which is a
 * finished frame rather than a hole.
 */
export const templateVisual = (assetId: string | undefined): DefaultAsset | null => {
  if (!assetId) return null;
  const asset = assetById(assetId);
  return asset && VISUAL_KINDS.has(asset.kind) ? asset : null;
};

/** Defaults that may not be published — the publish warning lists these. */
export const unlicensedDefaults = (srcs: readonly string[]): DefaultAsset[] =>
  DEFAULT_ASSETS.filter((asset) => !asset.licensed && srcs.includes(asset.src));
