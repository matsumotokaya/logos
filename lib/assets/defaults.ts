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

// `portrait` is a picture OF A PERSON, and it is deliberately not one of the
// VISUAL_KINDS below: a face cannot stand in for a backdrop. Trying it is a
// measured failure (freehand v1 reused a speaker photo as a ground — `cover`
// cannot push a face out of frame), and it is the reason Phase A3 wants
// "is there a person in this" as a measured property of every material.
export const ASSET_KINDS = [
  "bgm",
  "sfx",
  "ink_art",
  "texture",
  "b_roll",
  "still",
  "portrait",
  "mark",
] as const;
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
   * Multiplier that brings this file to the BGM pool's −16 dB reference.
   *
   * **Levelling, not a mix decision.** The SFX pool has done this since it was
   * built (scripts/fetch-default-sfx.mjs → catalog.json) and the BGM pool never
   * did, so two tracks mastered 5.5 dB apart — bright-corporate at −11.1,
   * ink-cinematic at −16.6 — were handed the same volume by the composition.
   * That made the film's music level a property of whoever mastered the chosen
   * track: swapping the BGM changed the mix, and the ink track sat about 10 dB
   * under the narration where it was supposed to sit just under it.
   *
   * Measured with `node scripts/measure-default-bgm.mjs`, committed because the
   * bytes are gitignored and a fresh clone cannot re-measure them. Absent means
   * unmeasured, so callers treat it as 1 and nothing silently goes quiet.
   */
  gain?: number;
  /**
   * The prompt in docs/demo-assets.md that produced this, for generated assets.
   *
   * Not user-facing. A generated picture cannot be restored from its recipe
   * (the same prompt yields a different image), so the bytes are committed —
   * but WHICH slot's requirements it was made against is exactly what a later
   * session needs in order to replace or extend it. The delivered filenames
   * are renamed on the way in (they carry the generating account's name, which
   * must never reach a viewer), so without this the link back is lost.
   */
  recipe?: string;
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
    // RMS −11.1 / peak 0.0 dB: the louder of the two by 5.5 dB, and already at
    // full scale — it can only come down.
    gain: 0.569,
    licensed: true,
  },
  {
    id: "bgm-ink-cinematic",
    kind: "bgm",
    src: "defaults/bgm/ink-cinematic.mp3",
    tone: "ink",
    label: "和モダン（重厚）",
    credit: "Suno AI（商用利用可プランで生成）",
    // RMS −16.6 / peak −1.4 dB. Peak-limited: the loudness target asks for more
    // and the headroom will not give it, which is also why the reference is −16
    // and not louder (scripts/measure-default-bgm.mjs).
    gain: 1.072,
    licensed: true,
  },

  // Pictures, subject "日本文化を学ぶ" (docs/demo-assets.md §5).
  //
  // Generated with Midjourney on a commercial plan, so unlike the licensed
  // stock and the real people's portraits under public/event/, these are ours
  // to redistribute — THE BYTES ARE COMMITTED. That is the whole point: a
  // fresh clone renders a complete film without running an asset script.
  //
  // Every one was measured before it was accepted: the copy side of each still
  // is both darker and quieter than the subject side (the requirement all
  // three slots share, because every event-cm layout puts its words on the
  // left). Verify with `npm run themes:compare`.
  {
    id: "still-tearoom-bowl",
    kind: "still",
    src: "defaults/stills/tearoom-bowl.jpg",
    tone: "ink",
    label: "茶室（茶碗と茶筅）",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-tearoom-01",
    licensed: true,
  },
  {
    id: "still-tearoom-hearth",
    kind: "still",
    src: "defaults/stills/tearoom-hearth.jpg",
    tone: "ink",
    label: "茶室（炉と光）",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-tearoom-02",
    licensed: true,
  },
  {
    id: "still-inkstone",
    kind: "still",
    src: "defaults/stills/inkstone.jpg",
    tone: "ink",
    label: "硯と筆",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-inkstone-01",
    licensed: true,
  },
  {
    id: "still-shoji-vase",
    kind: "still",
    src: "defaults/stills/shoji-vase.jpg",
    tone: "ink",
    label: "障子の光と壺",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-shoji-light-01",
    licensed: true,
  },
  {
    id: "still-venue-lanterns",
    kind: "still",
    src: "defaults/stills/venue-lanterns.jpg",
    tone: "ink",
    label: "会場（座卓と提灯）",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-venue-evening-01",
    licensed: true,
  },
  {
    id: "still-entrance-dusk",
    kind: "still",
    src: "defaults/stills/entrance-dusk.jpg",
    tone: "ink",
    label: "夕暮れの玄関",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "still-entrance-evening-01",
    licensed: true,
  },

  // Six DISTINCT fictional people, not variants of one.
  //
  // NO NAMES, here or anywhere. The seed proposes a ROLE (「ゲストスピーカー」)
  // and never a person, and a stock face must not quietly turn that into a
  // named individual — see docs/demo-assets.md §7. The labels below describe
  // what a person picking from a list can see, which is not the same as
  // inventing who they are.
  //
  // 960×1200 is deliberate, not a shortfall: the full-bleed speaker panel is
  // 960×1080, so these are used at native size rather than enlarged.
  {
    id: "portrait-speaker-01",
    kind: "portrait",
    src: "defaults/portraits/speaker-01-suit-glasses.jpg",
    tone: "ink",
    label: "男性・60代・スーツ（眼鏡）",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-01",
    licensed: true,
  },
  {
    id: "portrait-speaker-02",
    kind: "portrait",
    src: "defaults/portraits/speaker-02-suit.jpg",
    tone: "ink",
    label: "男性・60代・スーツ",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-01",
    licensed: true,
  },
  {
    id: "portrait-speaker-03",
    kind: "portrait",
    src: "defaults/portraits/speaker-03-blazer.jpg",
    tone: "ink",
    label: "女性・50代・ジャケット",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-02",
    licensed: true,
  },
  {
    id: "portrait-speaker-04",
    kind: "portrait",
    src: "defaults/portraits/speaker-04-blazer-grey.jpg",
    tone: "ink",
    label: "女性・60代・ジャケット",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-02",
    licensed: true,
  },
  {
    id: "portrait-speaker-05",
    kind: "portrait",
    src: "defaults/portraits/speaker-05-open-shirt.jpg",
    tone: "ink",
    label: "男性・40代・開襟シャツ",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-03",
    licensed: true,
  },
  {
    id: "portrait-speaker-06",
    kind: "portrait",
    src: "defaults/portraits/speaker-06-indigo.jpg",
    tone: "ink",
    label: "女性・70代・藍の上着",
    credit: "Midjourney（商用利用可プランで生成）",
    recipe: "portrait-speaker-04",
    licensed: true,
  },

  // Placeholder marks, authored as SVG rather than generated.
  //
  // Generative models cannot make these: a mark needs transparency, hard
  // edges, one colour, and a MEASURABLE luminance — `treatmentOn` reads the
  // artwork to decide whether to knock it out, and a raster approximation of a
  // logo has nothing reliable to measure. Same reason the LP's client logo wall
  // draws its own marks and ships no images.
  //
  // Every gap in them is real transparency, never a white fill. `knockout` is
  // `brightness(0) invert(1)`, so it paints every pixel white — a counter drawn
  // in white looks correct on any light mockup and then swallows the mark on
  // ink. Verified on both grounds before these were committed.
  //
  // `tone: "neutral"` because they read on either ground, which is not true of
  // anything else in the pool. NOT auto-attached to a brand: see the
  // 「ロゴは提案しない」 note in lib/event-cm/seed.ts.
  {
    id: "mark-gate",
    kind: "mark",
    src: "defaults/marks/gate.svg",
    tone: "neutral",
    label: "門（ダミー）",
    credit: "ダミーマーク（このリポジトリで作成）",
    licensed: true,
  },
  {
    id: "mark-ring",
    kind: "mark",
    src: "defaults/marks/ring.svg",
    tone: "neutral",
    label: "環（ダミー）",
    credit: "ダミーマーク（このリポジトリで作成）",
    licensed: true,
  },
  {
    id: "mark-strata",
    kind: "mark",
    src: "defaults/marks/strata.svg",
    tone: "neutral",
    label: "三層（ダミー）",
    credit: "ダミーマーク（このリポジトリで作成）",
    licensed: true,
  },
  {
    id: "mark-lattice",
    kind: "mark",
    src: "defaults/marks/lattice.svg",
    tone: "neutral",
    label: "組子（ダミー）",
    credit: "ダミーマーク（このリポジトリで作成）",
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

/**
 * The stock face a template puts in a speaker slot.
 *
 * Separate from `templateVisual` rather than a wider filter, because the two
 * must not be able to trade places. A face in a backdrop cannot be cropped out
 * of frame (`cover` has nowhere to push it), and a photograph of a room in a
 * medallion is not a person. Both directions are wrong, and one shared
 * accessor would let either happen from a single mistyped id.
 *
 * The picture is a sample and says so: the seed labels the guest it belongs to
 * (lib/event-cm/seed.ts). A face is the one guessed value a viewer cannot tell
 * is guessed by looking at it.
 */
export const templatePortrait = (assetId: string | undefined): DefaultAsset | null => {
  if (!assetId) return null;
  const asset = assetById(assetId);
  return asset?.kind === "portrait" ? asset : null;
};

/** Defaults that may not be published — the publish warning lists these. */
export const unlicensedDefaults = (srcs: readonly string[]): DefaultAsset[] =>
  DEFAULT_ASSETS.filter((asset) => !asset.licensed && srcs.includes(asset.src));

/**
 * The levelling multiplier for a pool file, by the src a brief holds.
 *
 * A brief points at `defaults/bgm/x.mp3`, not at a pool id, so the lookup is by
 * path. An unmeasured or unknown file returns 1: a missing measurement must not
 * silence a track that was playing.
 */
export const poolGain = (src: string | null | undefined): number => {
  if (!src) return 1;
  const asset = DEFAULT_ASSETS.find((entry) => entry.src === src);
  return asset?.gain ?? 1;
};
