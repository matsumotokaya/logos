// Read-model types for V2 video Takes.

import type { VideoTemplateId } from "./templates";

/** One row of the video portal's list. */
export interface VideoSummary {
  /** V2 Take id. */
  id: string;
  brandId: string;
  template: VideoTemplateId;
  title: string;
  published: boolean;
  /** How far along this video is, for the list's status line. */
  state: VideoState;
  createdAt: string;
  /** Retained in the UI read model; V2 always returns false. */
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
