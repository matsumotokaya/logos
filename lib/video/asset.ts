// What a video is, as a first-class brand asset.
//
// Before this, a "video" was not an entity at all: the brand tree derived one
// from each LP campaign by checking whether a CM voice track happened to exist
// on disk, so a brand could hold exactly one video and it could only ever be
// the product CM. A video is now a `brand_assets` row with
// asset_kind='video', which is what makes several videos per brand, more than
// one template, and re-running a video possible.
//
// The row's `metadata` carries the template and its payload. It is the source
// of truth after creation — a bundled brief only ever seeds the first copy, so
// editing a video never means editing repo code.

import type { EventBrief } from "@/remotion/event/types";
import type { VideoTemplateId } from "./templates";

/** `brand_assets.metadata` for asset_kind='video'. */
export interface VideoAssetMetadata {
  template: VideoTemplateId;
  /** Videos start unpublished: a brand's default product CM should be
   *  offerable without forcing anyone to publish it. */
  published: boolean;
  /** event-promo payload. Authored by hand today; the extraction/structuring
   *  pipeline will produce it later. */
  brief?: EventBrief;
  /** Which bundled brief seeded this video, for provenance only. */
  briefSlug?: string;
  /** product-cm payload: the campaign job that owns the Brand Kit, narration
   *  track and MP4. Kept as a link rather than copied so the existing CM
   *  pipeline stays the one implementation. */
  campaignJobId?: string;
  createdVia?: "portal" | "migration" | "campaign";
}

/** One row of the video portal's list. */
export interface VideoSummary {
  /** brand_assets.id, or the campaign job id for the not-yet-persisted
   *  default product CM (see `defaultProductVideo`). */
  id: string;
  brandId: string;
  template: VideoTemplateId;
  title: string;
  published: boolean;
  /** How far along this video is, for the list's status line. */
  state: VideoState;
  createdAt: string;
  /** True when this entry is the brand's implicit default rather than a row. */
  isPlaceholder: boolean;
}

export type VideoState =
  /** Nothing generated yet — the slot exists but is empty. */
  | "empty"
  /** Renderable in the browser right now. */
  | "preview_ready"
  /** An MP4 has been written. */
  | "mp4_ready";

export const VIDEO_STATE_LABEL: Record<VideoState, string> = {
  empty: "未作成",
  preview_ready: "プレビュー可",
  mp4_ready: "MP4あり",
};

export function parseVideoMetadata(raw: unknown): VideoAssetMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = raw as Partial<VideoAssetMetadata>;
  if (typeof meta.template !== "string") return null;
  return {
    template: meta.template as VideoTemplateId,
    published: meta.published === true,
    brief: meta.brief,
    briefSlug: meta.briefSlug,
    campaignJobId: meta.campaignJobId,
    createdVia: meta.createdVia,
  };
}
