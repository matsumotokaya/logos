// Read-model types for V2 video Takes.

import { videoTemplate, type VideoTemplateId } from "./templates";

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

/** What a take's state is derived from. The IO stays in the routes. */
export interface VideoStateInput {
  template: VideoTemplateId;
  /** An MP4 artifact this take has adopted. */
  hasRender: boolean;
  /** A brief the player could draw from. */
  hasBrief: boolean;
  /** A narration pinned onto the take (`brief.voice`). */
  hasVoice: boolean;
  /**
   * What the local generation job would say, for the one template that still
   * keeps one. A function, not a value: answering it reads the filesystem, and
   * most takes never reach the branch that asks. Omitted = no job to ask.
   */
  campaign?: () => VideoState;
}

/**
 * How far along a video is — the one derivation, for every template.
 *
 * Written down once because it was written down twice: the portal's list and
 * the detail screen each branched on the template id, and they had drifted.
 * The list asked the local job file before the renders, so a product-cm take
 * rendered through the Take pipeline read 「未作成」 in the list and 「MP4あり」
 * on its own page — the same take, two labels, on two screens a click apart.
 *
 * Nothing here names a template. What differs between them is one declared
 * property (`playableFromBrief`, lib/templates/catalog.ts), so a fourth video
 * template gets its answer by describing itself rather than by being added to a
 * branch in two API routes.
 */
export function videoState(input: VideoStateInput): VideoState {
  // An exported MP4 is an exported MP4, whichever template made it.
  if (input.hasRender) return "mp4_ready";
  if (videoTemplate(input.template)?.playableFromBrief ?? true) {
    return input.hasBrief ? "preview_ready" : "empty";
  }
  // Assembled around a recording: the voice is what gives the film a length.
  // Falling back to the job store covers takes generated before the narration
  // was pinned onto the take itself.
  return input.hasVoice ? "preview_ready" : (input.campaign?.() ?? "empty");
}
