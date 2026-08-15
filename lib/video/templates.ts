// Video templates, projected from the one catalog.
//
// This file used to BE the catalog. It is now a view over lib/templates, which
// covers every tool kind (LP, video, banner, guideline…) with the same shape,
// because the pivot made the template — not the video — the unit the product
// grows by (docs/old/schema-v2.md §8).
//
// The exports below are unchanged so the portal and the video detail screen
// keep working; what changed is that there is no second place to edit.
//
// A template is still chosen once, at creation, and never changed afterwards:
// it decides the scene structure, the material slots, and the brief schema the
// collection pipeline has to fill.

import { templatesForTool, type TemplateEntry } from "@/lib/templates/catalog";

const VIDEO_TEMPLATE_ENTRIES = templatesForTool("video");

export const VIDEO_TEMPLATE_IDS = VIDEO_TEMPLATE_ENTRIES.map(
  (template) => template.id,
) as readonly string[];

export type VideoTemplateId = string;

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
  /** Whether the brief alone is enough to play the film (catalog.ts). */
  playableFromBrief: boolean;
  /** Every brand gets exactly one of these by default, unpublished. */
  isBrandDefault: boolean;
}

const toVideoTemplate = (template: TemplateEntry): VideoTemplate => ({
  id: template.id,
  name: template.name,
  summary: template.summary,
  requires: template.requires,
  duration: template.duration ?? "",
  narration: template.narration ?? false,
  playableFromBrief: template.playableFromBrief ?? true,
  isBrandDefault: template.isBrandDefault,
});

export const VIDEO_TEMPLATES: Record<VideoTemplateId, VideoTemplate> =
  Object.fromEntries(
    VIDEO_TEMPLATE_ENTRIES.map((template) => [template.id, toVideoTemplate(template)]),
  );

export const videoTemplate = (id: string): VideoTemplate | null =>
  VIDEO_TEMPLATES[id] ?? null;

export const isVideoTemplateId = (id: string): id is VideoTemplateId =>
  Object.hasOwn(VIDEO_TEMPLATES, id);

/** Templates offered in the "add a video" dialog, in display order. */
export const ADDABLE_VIDEO_TEMPLATES: VideoTemplate[] =
  VIDEO_TEMPLATE_ENTRIES.map(toVideoTemplate);
