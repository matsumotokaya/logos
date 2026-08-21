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

import {
  templateName,
  templatesForTool,
  type TemplateEntry,
} from "@/lib/templates/catalog";

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
  /** Whether edits collect in a workbench brief and reach the film on request. */
  bakesBrief: boolean;
  /** Every brand gets exactly one of these by default, unpublished. */
  isBrandDefault: boolean;
  /** The kind of film, e.g. 製品紹介動画. Falls back to `name`. */
  family: string;
  /** The art direction inside the family, e.g. モダンジャパニーズ. */
  variant: string;
}

const toVideoTemplate = (template: TemplateEntry): VideoTemplate => ({
  id: template.id,
  name: templateName(template),
  summary: template.summary,
  requires: template.requires,
  duration: template.duration ?? "",
  narration: template.narration ?? false,
  playableFromBrief: template.playableFromBrief ?? true,
  bakesBrief: template.bakesBrief ?? false,
  isBrandDefault: template.isBrandDefault,
  family: template.family ?? templateName(template),
  variant: template.variant ?? templateName(template),
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

export interface VideoTemplateFamily {
  /** The kind of film. Also the radio label in the add dialog. */
  name: string;
  /** The styles it can be made in, in catalog order. Never empty. */
  variants: VideoTemplate[];
}

/**
 * The addable templates grouped by family, in catalog order.
 *
 * The dialog asks for the kind of film first and the style second. A family
 * with one style still gets a picker: "there is one way to make this, and it
 * has a name" is information, and it is the shape the second style arrives in
 * without the screen changing.
 *
 * Order comes from `TEMPLATES` and nowhere else — a second list of families
 * here would be a second place to edit, which is the thing lib/templates was
 * introduced to remove.
 */
export const VIDEO_TEMPLATE_FAMILIES: VideoTemplateFamily[] =
  ADDABLE_VIDEO_TEMPLATES.reduce<VideoTemplateFamily[]>((families, template) => {
    const found = families.find((family) => family.name === template.family);
    if (found) found.variants.push(template);
    else families.push({ name: template.family, variants: [template] });
    return families;
  }, []);

/** What the add dialog starts on: the first style of the first family. */
export const DEFAULT_ADDABLE_VIDEO_TEMPLATE: VideoTemplateId =
  VIDEO_TEMPLATE_FAMILIES[0].variants[0].id;

/**
 * Where a template's family sits in the catalog order, for grouping the list.
 *
 * Unknown ids sort last rather than first: a take pinned to a template that has
 * since left the catalog is still a real video, and it should not lead the page.
 */
export const videoFamilyIndex = (id: string): number => {
  const index = VIDEO_TEMPLATE_FAMILIES.findIndex((family) =>
    family.variants.some((variant) => variant.id === id),
  );
  return index === -1 ? VIDEO_TEMPLATE_FAMILIES.length : index;
};
