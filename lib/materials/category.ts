// What a material DEPICTS — the first of the two axes.
//
// docs/asset-normalization.md §5. This is a property of the bytes: a photograph
// of a person is a photograph of a person whether it ends up in a video, on a
// landing page, or in a banner. It is deliberately NOT "what this deliverable
// uses it for" — that is the second axis, and it lives with the deliverable
// (the brief's slots, take_inputs.role), because the same key visual can be a
// product shot in one campaign and a background in the next.
//
// Kept separate from `brand_materials.kind`, which stays the MEDIUM (logo /
// photo / audio / document / font …) — how to handle the bytes. Two questions:
//   kind      how do I decode and draw this
//   category  what is in it
//
// Why this vocabulary and not the one already in the codebase: the classifier
// in lib/event-cm/structure.ts speaks event-cm — it has `speaker-portrait` and
// `venue`, no `product`, and `key-visual` (which is a USE, not a content type,
// and so belongs to the other axis). None of that survives contact with a
// landing page or a banner.
//
// THIS LIST WILL GROW, and that is designed for rather than guarded against.
// Adding a value is one line here plus a one-line migration; nothing already
// stored changes meaning. What must not happen is the list growing sideways
// into things that are not materials at all — see NOT_A_MATERIAL below.

/** The universal content vocabulary. Order is the order a picker shows. */
export const MATERIAL_CATEGORIES = [
  "person",
  "product",
  "screen",
  "place",
  "scenery",
  "mark",
  "graphic",
  "document",
  "texture",
  "other",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/**
 * The name shown to a person, in one place.
 *
 * Same rule as EVENT_CM_SCENE_LABELS: a screen and a prompt that disagree about
 * what something is called are two vocabularies pretending to be one.
 */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  person: "人物",
  product: "製品・サービス",
  screen: "画面・UI",
  place: "場所",
  scenery: "情景",
  mark: "ロゴ・マーク",
  graphic: "図版・イラスト",
  document: "資料",
  texture: "質感・装飾",
  other: "その他",
};

/** What each one covers, for the picker's help text and for the prompt. */
export const MATERIAL_CATEGORY_HINTS: Record<MaterialCategory, string> = {
  person: "人物が主役。登壇者・スタッフ・お客様の顔",
  product: "製品・サービスそのもの。パッケージ・現物・提供している料理",
  screen: "画面・UI。アプリやサイトのスクリーンショット、デモ画面",
  place: "場所そのもの。会場・店舗・オフィス・外観",
  scenery: "情景・雰囲気。人や物が主役ではない状況カット",
  mark: "ロゴ・シンボル・アイコン",
  graphic: "図版・イラスト・図解・チャート",
  document: "文字が主役。資料ページ・チラシ・企画書",
  texture: "質感・装飾・地に敷くための素材",
  other: "どれにも当てはまらない",
};

/**
 * Things that look like they want to be categories and are not.
 *
 * Recorded because the question comes back every time a new deliverable is
 * designed, and answering it the wrong way quietly breaks the model.
 *
 * - 価格・プラン、お客様の声の本文、3つのポイント、タグライン、説明文
 *   These are CLAIMS, not files. They belong to BrandKnowledge
 *   (`brand_knowledge_claims` / `brand_knowledge_values`, whose field paths
 *   already include `offer.*` and `evidence.*`) and get projected into a
 *   brief. A material is bytes; a price is a fact. Putting a price in this
 *   enum would mean inventing a file to hold it.
 *
 * - バナー・サムネイルの解像度違い
 *   Not a category — the same picture at another size is the SAME content.
 *   Size is measured (`width`/`height`, §6) and a resized copy is a derived
 *   material (`derived_from_material_id`, §11). Categorising by size would
 *   make one photograph three different things.
 *
 * - キービジュアル / 提供マーク / 登壇者の写真
 *   These are uses, not contents — the second axis. A key visual is whatever
 *   the campaign put in that slot.
 */
export const NOT_A_MATERIAL_CATEGORY = [
  "claims (price, testimonials, taglines) → BrandKnowledge",
  "resolution variants → derived materials, measured width",
  "slot names (key visual, provider mark) → the deliverable's axis",
] as const;

const CATEGORY_SET = new Set<string>(MATERIAL_CATEGORIES);

export const isMaterialCategory = (value: unknown): value is MaterialCategory =>
  typeof value === "string" && CATEGORY_SET.has(value);

/** Label for a stored value, tolerating the null that "not classified" is. */
export const materialCategoryLabel = (value: string | null | undefined): string =>
  isMaterialCategory(value) ? MATERIAL_CATEGORY_LABELS[value] : "未分類";

/**
 * Who decided the category.
 *
 * `inferred` may be replaced by a later run — that is what makes a wrong guess
 * self-healing. `user` never is: a person who corrected a classification has
 * said something the next model run does not get to overrule. Same shape as the
 * brief's provenance, and the same reason the scenario keeps `source: "human"`.
 */
export const CATEGORY_SOURCES = ["inferred", "user"] as const;
export type CategorySource = (typeof CATEGORY_SOURCES)[number];

/**
 * The event-cm classifier's reading, translated to the shared vocabulary.
 *
 * The classifier answers both axes now, but older runs recorded only the
 * event-cm `role`, and a run that omits the category still has to yield one —
 * so the mapping stays as the deterministic fallback rather than being deleted
 * once the prompt was updated.
 *
 * `key-visual` and `scene-photo` both land on `scenery` because neither says
 * what is IN the picture: they say how the film wanted to use it. Losing that
 * distinction here is correct — placement still reads the original role.
 */
const ROLE_TO_CATEGORY: Record<string, MaterialCategory | null> = {
  "speaker-portrait": "person",
  "key-visual": "scenery",
  "scene-photo": "scenery",
  venue: "place",
  logo: "mark",
  document: "document",
  texture: "texture",
  // Not "other": the model said it could not read the picture, and "we do not
  // know" has to stay distinguishable from "we looked and it is nothing".
  unreadable: null,
};

export const categoryFromImageRole = (
  role: string | null | undefined,
): MaterialCategory | null => (role ? (ROLE_TO_CATEGORY[role] ?? null) : null);
