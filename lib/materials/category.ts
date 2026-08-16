// What a FILE contains. The service's one absolute classification.
//
// docs/asset-normalization.md §5. The product classifies two different things
// and they do not share an axis:
//
//   FILES        one vocabulary, service-wide, template-independent.  ← here
//                A photograph of a person is a photograph of a person
//                whether it ends up in a video, a landing page or a banner.
//
//   INFORMATION  the template's own ontology, different per template.
//                An event knows a venue, a fee and a programme; a landing page
//                knows plans, testimonials and an FAQ; a product film knows a
//                script. There is no shared list, and inventing one would mean
//                every template carrying every other template's fields.
//
// The test for which side something is on: CAN YOU OPEN IT? An image, a PDF,
// an audio file — a material, classified here. Do you merely read it — a price,
// a name, a date, a venue — information, and it lives in the brief. "3,000円"
// has no bytes, so it cannot have a row (brand_materials requires r2_key or
// logo_candidate_id; see 0028's materials_has_body).
//
// The same real-world thing routinely splits across both. An event's venue is
// the string "WealthPark Lab 東京オフィス" in brief.schedule.venue AND a
// photograph of the building with category='place'. That is not duplication —
// they are a fact and a file, and only one of them can be shown on screen.
//
// Kept separate from `brand_materials.kind`, which stays the MEDIUM (logo /
// photo / audio / document / font …). Two questions about one file:
//   kind      how do I decode and draw this
//   category  what is in it
//
// Also separate from where a deliverable PUTS a file — its slot (the brief's
// visuals.value, take_inputs.role). That belongs to the template's ontology
// too, which is why `key-visual` is not in this list: it names a slot, and the
// same picture is a key visual in one campaign and a background in the next.
//
// THIS LIST WILL GROW, and that is designed for rather than guarded against.
// Adding a value is one line here plus a one-line migration; nothing already
// stored changes meaning. It grows slowly, because a new template brings new
// INFORMATION (which does not touch this list) far more often than it brings a
// genuinely new kind of file. See NOT_A_MATERIAL_CATEGORY below.

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
  person: "人物の写真",
  product: "製品・サービスの写真",
  screen: "画面・UIの画像",
  place: "場所の写真",
  scenery: "情景の写真",
  mark: "ロゴ・マーク",
  graphic: "図版・イラスト",
  document: "資料",
  texture: "質感・装飾",
  other: "その他",
};

/**
 * What each one covers, for the picker's help text and for the prompt.
 *
 * Every label and hint names A FILE, never information. "場所" alone reads as
 * "the venue field"; "場所の写真" cannot. The distinction is the whole model
 * (see the header), so the wording carries it rather than relying on the reader
 * having read the spec.
 */
export const MATERIAL_CATEGORY_HINTS: Record<MaterialCategory, string> = {
  person: "人物の顔が主役。登壇者・スタッフ・お客様",
  product: "製品・現物そのもの。パッケージ・提供している料理",
  screen: "アプリやサイトの画面。スクリーンショット・デモ画面",
  place: "場所が写っている写真。会場・店舗・オフィス・物件の外観や内観",
  scenery: "人も物も主役でない雰囲気カット。地に敷ける情景",
  mark: "ロゴ・シンボル・アイコン",
  graphic: "図版・イラスト・図解・チャート",
  document: "文字が主役。資料ページ・チラシ・企画書",
  texture: "質感・装飾のための素材",
  other: "どれにも当てはまらない",
};

/**
 * Things that look like they want to be categories and are not.
 *
 * Recorded because the question comes back every time a new deliverable is
 * designed, and answering it the wrong way quietly breaks the model.
 *
 * - 価格・プラン、お客様の声の本文、3つのポイント、タグライン、説明文、
 *   会場名、開催日、氏名
 *   Information, not files — the template's ontology. They already have homes:
 *   an event's fee is brief.schedule.fee, a landing page's plans are
 *   kit.pricing.plans, and BrandKnowledge (`offer.*`, `evidence.*`) is where
 *   they go when they outlive one deliverable.
 *
 *   Adding `price` here would mean giving a price a ROW, and a row needs bytes
 *   (materials_has_body). So a text object containing "3,000円" would have to
 *   be written to R2 purely to have something to label — after which editing
 *   the price creates a second object, and reading it means a lookup plus a
 *   download instead of reading one JSON field. That is what "inventing a file
 *   to hold the value" means.
 *
 * - バナー・サムネイルの解像度違い
 *   Not a category — the same picture at another size is the SAME content.
 *   Size is measured (`width`/`height`, §6) and a resized copy is a derived
 *   material (`derived_from_material_id`, §11). Categorising by size would
 *   make one photograph three different things.
 *
 * - キービジュアル / 提供マーク / 登壇者の写真
 *   Slot names. Which slot a file fills is the template's ontology; a key
 *   visual is whatever that campaign put there.
 */
export const NOT_A_MATERIAL_CATEGORY = [
  "information (price, venue name, testimonials, taglines) → the template's brief / BrandKnowledge",
  "resolution variants → derived materials, measured width",
  "slot names (key visual, provider mark) → the template's ontology",
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
