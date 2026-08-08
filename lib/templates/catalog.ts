// The template catalog — what kinds of marketing tool this product can make.
//
// This is the authority (docs/schema-v2.md §8). public.template_versions is a
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
 *  template does not declare is refused (docs/schema-v2.md §12). */
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
  name: string;
  summary: string;
  /** What the template needs in order to render at all. */
  requires: string;
  duration?: string;
  /** Video-specific: whether narration is part of the template. */
  narration?: boolean;
  stages: PipelineStage[];
  publishSurfaces: PublishSurface[];
  costProfile: CostProfile;
  defaultRenders: RenderSpec[];
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
    id: "event-promo",
    version: 1,
    toolKind: "video",
    briefSchemaVersion: 1,
    rendererRevision: "remotion/event@2026-08-04",
    name: "イベント動画",
    summary:
      "イベント・セミナー告知の30秒PV。和モダンの固定タイムラインで、ナレーションを持たずBGMとタイポグラフィで成立させます。素材が無いスロットは設計済みのフォールバックで描かれます。",
    requires: "イベントの文言・日時・登壇者（EventBrief）",
    duration: "30秒",
    narration: false,
    // No LLM anywhere: the brief is authored, and the renderer is deterministic.
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
    id: "product-cm",
    version: 2,
    toolKind: "video",
    briefSchemaVersion: 2,
    rendererRevision: "remotion/cm@2026-08-07-v2-materials",
    name: "製品紹介動画",
    summary:
      "課題解決型の30秒CM。Service Brand Kitのコピーとナレーションから、ロゴ・配色をそのまま使って組み立てます。",
    requires: "ソース（URL・PDF・テキスト）から生成したService Brand Kit",
    duration: "30秒",
    narration: true,
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
    name: template.name,
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
