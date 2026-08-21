// The template catalog — what kinds of marketing tool this product can make.
//
// This is the authority (docs/old/schema-v2.md §8). public.template_versions is a
// ledger of what has existed, written from here by lib/templates/ledger.ts; it
// is never edited by hand and never treated as the definition.
//
// Adding a template means adding an entry here plus its renderer and its brief
// schema. The order is deliberate: the template declares the shape of the data
// it needs, and that shape is what the collection pipeline goes and fills.
//
// Deliberately free of zod and of any server-only import: the video portal and
// the add dialog are client components and only need this metadata.

export const TOOL_KINDS = [
  "lp",
  "video",
  "banner",
  "guideline",
  "logo_presentation",
  "site",
  "merch",
  "document",
  "other",
] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

/** The fixed small vocabulary a template picks a subset of. */
export const PIPELINE_STAGES = [
  "collect",
  "extract",
  "structure",
  "render",
  "publish",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Surfaces a template is able to publish to. Publishing to a surface the
 *  template does not declare is refused (docs/old/schema-v2.md §12). */
export const PUBLISH_SURFACES = [
  "canonical_url",
  "vanity_url",
  "embed",
  "social",
  "custom_domain",
] as const;
export type PublishSurface = (typeof PUBLISH_SURFACES)[number];

export type RenderFormat = "mp4" | "html" | "png" | "pdf" | "svg" | "wav";

/** One output unit the template produces by default. Locale, aspect ratio and
 *  theme belong to the render, never to the take. */
export interface RenderSpec {
  locale: string;
  aspectRatio: string;
  theme: string;
  format: RenderFormat;
}

export interface CostProfile {
  /** Charged LLM calls happen in this template's pipeline. */
  llm: boolean;
  /** Charged text-to-speech happens. */
  tts: boolean;
  /** none = derived on read, local = needs headless Chrome, cloud = Lambda. */
  render: "none" | "local" | "cloud";
}

export interface TemplateEntry {
  id: string;
  /** Bumped whenever the rendered result or the brief shape can change. Takes
   *  pin this number, so an old take keeps pointing at what it was made with. */
  version: number;
  toolKind: ToolKind;
  briefSchemaVersion: number;
  /** Identifies the renderer build. Recorded on the ledger row so "why does
   *  this look different" has an answer that is not "we think it changed". */
  rendererRevision: string;
  /**
   * The display name, for templates that do NOT belong to a family.
   *
   * A template with a `family` must not set this: its name IS
   * `family - variant`, derived by `templateName()`. Two places holding the
   * name is how the picker and the list came to disagree — the dialog said
   * イベント紹介動画/スタンダード while the badge said イベント動画.
   */
  name?: string;
  summary: string;
  /** What the template needs in order to render at all. */
  requires: string;
  duration?: string;
  /** Video-specific: whether narration is part of the template. */
  narration?: boolean;
  /**
   * Video-specific: whether the brief alone is enough to play the film.
   *
   * True for the templates that hand back a finished film the moment the take
   * exists — the fallbacks are designed, so nothing is missing. False for one
   * that assembles around a recorded narration: without it there is no timeline
   * to draw, and calling that state "playable" would put a player on screen
   * with nothing in it. Defaults to true, which is the product's stance.
   */
  playableFromBrief?: boolean;
  /**
   * Video-specific: whether editing accumulates instead of reaching the film.
   *
   * True means the take carries two briefs — the one being edited and the one a
   * run fixed — and the player, the export and the public URL all read the
   * fixed one (`takes.baked_brief`, migration 0050). The screen then owes the
   * user an account of the difference, which is what `lib/event-cm/bake.ts`
   * computes. False (the default) means a saved edit is the film.
   */
  bakesBrief?: boolean;
  /**
   * Video-specific: the id of the pool track a new take starts with.
   *
   * THE DEFAULT BGM BELONGS TO THE TEMPLATE, not to the brand and not to the
   * brand's industry (owner's decision, 2026-08-17). An event promo and a
   * product film want different music because they are different kinds of
   * film — that is a property of the template, and it does not vary by who is
   * making one. Every new take of a template gets the same track.
   *
   * It used to be chosen from the seeded archetype's `tone`, which made the
   * music a consequence of the brand's industry: two takes of the same template
   * could open with different music for no reason the user had chosen.
   *
   * The ids below are PLACEHOLDERS from the two tracks currently in the pool.
   * Proper per-template tracks are to be commissioned; swapping them is editing
   * this field, and nothing else moves — existing takes keep whatever their
   * brief already points at, because a brief is not re-seeded.
   */
  defaultBgm?: string;
  /**
   * Video-specific: pool artwork a new take dresses its visual slots with.
   *
   * Keyed by the brief path the picture fills (`visuals.value`), valued with a
   * pool asset id. Same rule as `defaultBgm`, one tier down the ladder:
   *
   *   1. the BRAND's own picture, when it has one
   *   2. the TEMPLATE's stock picture — here
   *   3. the composition's designed substitute (an ink ground, gold particles)
   *
   * Tier 1 is what a key visual should be, and mostly is not: a brand arrives
   * with a logo, a palette and some type, and hardly ever with photography. So
   * the template needs a decent picture of its own rather than falling
   * straight to tier 3 every time.
   *
   * EMPTY TODAY, deliberately. The pool carries no images yet (owner is
   * preparing them, 2026-08-17), and pointing at artwork that does not exist
   * would put broken slots in every new film. The mechanism is here so that
   * arriving artwork is a pool entry plus a line in this map — the same shape
   * the BGM already has.
   */
  defaultVisuals?: Record<string, string>;
  stages: PipelineStage[];
  publishSurfaces: PublishSurface[];
  costProfile: CostProfile;
  defaultRenders: RenderSpec[];
  /**
   * Video-specific: the kind of film this is, and the style it is made in.
   *
   * A FAMILY is a kind of film (a product introduction, an event
   * introduction). A VARIANT is the art direction it is made in. The add
   * dialog asks for the family first and the style second, because that is the
   * order the decision is actually made in — "I need an event video" comes
   * before "and I want the modern-Japanese look".
   *
   * The pair still resolves to ONE template id, and the id is what a take
   * pins. So this is grouping for display, not a second axis in the data:
   * adding a style means adding an entry here, exactly as before.
   *
   * Not part of `templateSpec()`. The ledger records what a version promised —
   * scene structure, cost, surfaces — and how the picker groups it is not that.
   * Regrouping the dialog must not look like the template changed.
   */
  family?: string;
  variant?: string;
  /** Every brand is offered exactly one of these, unpublished. */
  isBrandDefault: boolean;
  /**
   * Whether a take pinned to THIS version can still be re-rendered after a
   * newer version ships. Declared honestly rather than assumed: a template
   * whose inputs live outside its own row cannot promise it.
   */
  rerenderable: boolean;
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: "logo-presentation",
    version: 1,
    toolKind: "logo_presentation",
    briefSchemaVersion: 1,
    rendererRevision: "react/presentation@2026-08-08",
    name: "ロゴプレゼンテーション",
    summary:
      "ロゴの正本データと編集済みコピー、採用アセット配置から構成する恒久プレゼンテーションです。",
    requires: "ロゴ正本とプレゼンテーション編集内容",
    stages: ["collect", "render", "publish"],
    publishSurfaces: ["canonical_url", "vanity_url"],
    costProfile: { llm: false, tts: false, render: "none" },
    defaultRenders: [
      { locale: "und", aspectRatio: "responsive", theme: "", format: "html" },
    ],
    isBrandDefault: false,
    // The view resolves the immutable template version plus the still-canonical
    // logo master and this Take's editorial snapshot at request time.
    rerenderable: true,
  },
  {
    id: "product-cm",
    version: 2,
    toolKind: "video",
    briefSchemaVersion: 2,
    rendererRevision: "remotion/cm@2026-08-07-v2-materials",
    summary:
      "課題解決型の30秒CM。Service Brand Kitのコピーとナレーションから、ロゴ・配色をそのまま使って組み立てます。",
    requires: "ソース（URL・PDF・テキスト）から生成したService Brand Kit",
    duration: "30秒",
    narration: true,
    // Placeholder: a product film is not 和モダン, so it takes the other track.
    defaultBgm: "bgm-bright-corporate",
    // The brief is a Brand Kit plus narration timing: until the voice has been
    // recorded and pinned, there is no length and nothing to play.
    playableFromBrief: false,
    family: "製品紹介動画",
    variant: "スタンダード",
    stages: ["collect", "extract", "structure", "render", "publish"],
    publishSurfaces: ["canonical_url", "embed"],
    costProfile: { llm: true, tts: true, render: "local" },
    defaultRenders: [
      { locale: "ja", aspectRatio: "16:9", theme: "", format: "mp4" },
    ],
    isBrandDefault: true,
    // Kit, timing metadata and the pinned voice material all live with the
    // Take, so a render no longer depends on the local campaign job store.
    rerenderable: true,
  },
  {
    id: "event-promo",
    version: 1,
    toolKind: "video",
    briefSchemaVersion: 1,
    rendererRevision: "remotion/event@2026-08-04",
    summary:
      "イベント・セミナー告知の30秒PV。和モダンの固定タイムラインで、読み上げを持たずBGMとタイポグラフィで成立させます。素材が無いスロットは設計済みのフォールバックで描かれます。",
    requires: "イベントの文言・日時・登壇者（EventBrief）",
    duration: "30秒",
    narration: false,
    // Placeholder: the only 和モダン track in the pool. This film has no voice,
    // so the music carries it alone and deserves its own commissioned track.
    defaultBgm: "bgm-ink-cinematic",
    // No LLM anywhere: the brief is authored, and the renderer is deterministic.
    family: "イベント紹介動画",
    variant: "スタンダード",
    stages: ["collect", "render", "publish"],
    publishSurfaces: ["canonical_url", "embed", "social"],
    costProfile: { llm: false, tts: false, render: "local" },
    defaultRenders: [
      { locale: "ja", aspectRatio: "16:9", theme: "sumi", format: "mp4" },
    ],
    isBrandDefault: false,
    // The brief lives on the take and the composition is pure, so an old
    // version can be rendered again as long as its materials still exist.
    rerenderable: true,
  },
  {
    id: "event-cm",
    version: 1,
    toolKind: "video",
    briefSchemaVersion: 1,
    rendererRevision: "remotion/event-cm@2026-08-18",
    summary:
      "イベント告知のナレーション駆動CM。ナレーションを先に書き、そのボイスのタイミングが画面の尺と並びを決めます。絵はモダンジャパニーズ（墨黒×金×明朝・シネスコ帯・写真主役）で、章の転換や登壇者の登場は和の効果音が刻みます。素材が無いスロットは設計済みのフォールバックで描かれます。",
    requires: "イベントの事実（EventBrief）と、そこから書いたナレーション",
    duration: "30秒前後（ナレーションとボイスの長さで決まる）",
    narration: true,
    // Placeholder: matches the 墨黒×金×明朝 art direction. Ducks under the
    // narration and returns for the closing mark.
    defaultBgm: "bgm-ink-cinematic",
    // The storyboard is a workbench: edits collect there and reach the film
    // only when the user asks. The only template that works this way today.
    bakesBrief: true,
    // The script is written by an LLM from the brief, then spoken. Both are
    // charged, and both re-run only when asked.
    family: "イベント紹介動画",
    variant: "モダンジャパニーズ",
    stages: ["collect", "structure", "render", "publish"],
    publishSurfaces: ["canonical_url", "embed", "social"],
    costProfile: { llm: true, tts: true, render: "local" },
    defaultRenders: [
      { locale: "ja", aspectRatio: "16:9", theme: "sumi", format: "mp4" },
    ],
    isBrandDefault: false,
    // Script, voice timing and the pinned WAV all live on the take, so an old
    // version renders again as long as its materials exist.
    rerenderable: true,
  },
  {
    id: "campaign-lp",
    version: 2,
    toolKind: "lp",
    briefSchemaVersion: 2,
    rendererRevision: "lib/campaign/render-lp@2026-08-05",
    name: "セールスページ",
    summary:
      "ソースから生成したService Brand Kitを、業種に合わせた7種のデザインテーマのいずれかで1枚のセールスページに描画します。テーマは後から変更して再レンダーできます。",
    requires: "ソース（URL・PDF・テキスト）から生成したService Brand Kit",
    stages: ["collect", "extract", "structure", "render", "publish"],
    publishSurfaces: ["canonical_url", "vanity_url"],
    // The page is derived from the kit on every read, so rendering costs nothing.
    costProfile: { llm: true, tts: false, render: "none" },
    defaultRenders: [
      { locale: "ja", aspectRatio: "responsive", theme: "", format: "html" },
    ],
    isBrandDefault: false,
    rerenderable: true,
  },
];

/**
 * The one derivation of a template's display name.
 *
 * Grouped templates are named by their pair (`イベント紹介動画 - モダンジャパニーズ`);
 * ungrouped ones carry an explicit `name`. Every screen reads this, so adding a
 * style or renaming a family moves the picker, the list badge, the video detail
 * header and the default take title together.
 */
export const templateName = (template: TemplateEntry): string =>
  template.name ?? [template.family, template.variant].filter(Boolean).join(" - ");

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

/** The current version of a template. Takes pin a version and must not use this
 *  to resolve one they were not created with. */
export const currentTemplate = (id: string): TemplateEntry | null =>
  BY_ID.get(id) ?? null;

export const isTemplateId = (id: string): boolean => BY_ID.has(id);

export const templatesForTool = (toolKind: ToolKind): TemplateEntry[] =>
  TEMPLATES.filter((template) => template.toolKind === toolKind);

/**
 * The serializable form written to the ledger's `spec`. The brief schema is not
 * in here (it is code); what is in here is everything a later reader needs in
 * order to say what this version promised.
 */
export function templateSpec(template: TemplateEntry): Record<string, unknown> {
  return {
    name: templateName(template),
    summary: template.summary,
    requires: template.requires,
    duration: template.duration ?? null,
    narration: template.narration ?? null,
    stages: template.stages,
    publishSurfaces: template.publishSurfaces,
    costProfile: template.costProfile,
    defaultRenders: template.defaultRenders,
    isBrandDefault: template.isBrandDefault,
    rerenderable: template.rerenderable,
  };
}
