// Video template catalog — the source of truth for "which kinds of video can
// this product make". Adding a template means adding an entry here plus its
// renderer; the portal's add dialog and the video detail screen both read
// this list, so neither hardcodes a template name.
//
// A template is chosen once, when the video is created, and is not changed
// afterwards: it decides the scene structure, what material slots exist, and
// which structuring prompt will eventually fill them. Same reason
// slide-factory fixes a property's `deliverable` at creation time.

export const VIDEO_TEMPLATE_IDS = ["product-cm", "event-promo"] as const;

export type VideoTemplateId = (typeof VIDEO_TEMPLATE_IDS)[number];

export interface VideoTemplate {
  id: VideoTemplateId;
  /** Short label used in the add dialog and the video list. */
  name: string;
  /** One line on what this template produces. */
  summary: string;
  /** What the template needs in order to render at all. */
  requires: string;
  /** Display length, e.g. "30秒". */
  duration: string;
  /** Whether narration is part of the template. */
  narration: boolean;
  /** Every brand gets exactly one of these by default, unpublished. */
  isBrandDefault: boolean;
}

export const VIDEO_TEMPLATES: Record<VideoTemplateId, VideoTemplate> = {
  "product-cm": {
    id: "product-cm",
    name: "製品紹介動画",
    summary:
      "課題解決型の30秒CM。Service Brand Kitのコピーとナレーションから、ロゴ・配色をそのまま使って組み立てます。",
    requires: "ソース（URL・PDF・テキスト）から生成したService Brand Kit",
    duration: "30秒",
    narration: true,
    // The product CM is the slot every brand starts with, whether or not it
    // has been generated — the portal always shows it, unpublished.
    isBrandDefault: true,
  },
  "event-promo": {
    id: "event-promo",
    name: "イベント動画",
    summary:
      "イベント・セミナー告知の30秒PV。和モダンの固定タイムラインで、ナレーションを持たずBGMとタイポグラフィで成立させます。素材が無いスロットは設計済みのフォールバックで描かれます。",
    requires: "イベントの文言・日時・登壇者（EventBrief）",
    duration: "30秒",
    narration: false,
    isBrandDefault: false,
  },
};

export const videoTemplate = (id: string): VideoTemplate | null =>
  (VIDEO_TEMPLATES as Record<string, VideoTemplate>)[id] ?? null;

export const isVideoTemplateId = (id: string): id is VideoTemplateId =>
  Object.hasOwn(VIDEO_TEMPLATES, id);

/** Templates offered in the "add a video" dialog, in display order. */
export const ADDABLE_VIDEO_TEMPLATES: VideoTemplate[] = VIDEO_TEMPLATE_IDS.map(
  (id) => VIDEO_TEMPLATES[id],
);
