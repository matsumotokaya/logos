import { z } from "zod";

// Runtime shape of an EventBrief (remotion/event/types.ts is the type side).
//
// This validates STRUCTURE, not completeness. Every fact is allowed to be empty
// or null, because that is the template's whole design: a null venue is an
// elegant omission, not an error, and a brief with nothing but a title still
// renders a finished video. What is missing becomes a collection task in the
// UI — never a validation failure that blocks the take from existing.
//
// Strictness is therefore about the things that WOULD break a render: a photo
// without a src, a focus point outside the frame, a logo treatment nobody
// implements.

export const EventPhotoSchema = z.object({
  src: z.string().min(1),
  focus: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .optional(),
  zoom: z.number().positive().optional(),
});

export const EventLogoSchema = z.object({
  name: z.string(),
  src: z.string().nullable(),
  treatment: z.enum(["light", "invert"]).optional(),
  scale: z.number().positive().optional(),
});

export const EventGuestSchema = z.object({
  name: z.string(),
  role: z.string(),
  photo: EventPhotoSchema.nullable(),
});

export const EventProgramSchema = z.object({
  title: z.string(),
});

export const EventScheduleSchema = z.object({
  date: z.string(),
  weekday: z.string(),
  time: z.string(),
  venue: z.string().nullable(),
  fee: z.string().nullable(),
});

export const EventVisualsSchema = z.object({
  inkArt: z.string().nullable(),
  value: EventPhotoSchema.nullable(),
  programs: EventPhotoSchema.nullable(),
  closing: EventPhotoSchema.nullable(),
  texture: z.string().nullable(),
});

export const EventBriefSchema = z.object({
  presenter: z.string(),
  seriesLabel: z.string(),
  title: z.string(),
  subtitle: z.string(),
  sideCopy: z.string().nullable(),
  valueLines: z.array(z.string()),
  valueChip: z.string().nullable(),
  programsHeading: z.string(),
  programs: z.array(EventProgramSchema),
  guestsHeading: z.string(),
  guests: z.array(EventGuestSchema),
  schedule: EventScheduleSchema,
  cta: z.string(),
  footnote: z.string().nullable(),
  logos: z.array(EventLogoSchema),
  visuals: EventVisualsSchema,
  bgm: z.string().nullable(),
});

export type EventBriefInput = z.infer<typeof EventBriefSchema>;

/**
 * Which slots a person still has to fill. This is NOT a completeness score:
 * an unfilled slot has a designed fallback and the video is finished either
 * way (docs/deliverable-architecture.md §6). It exists so the UI can offer the
 * next useful action, not to grade the brief.
 */
export function eventBriefGaps(brief: EventBriefInput): string[] {
  const gaps: string[] = [];
  if (!brief.title.trim()) gaps.push("title");
  if (!brief.presenter.trim()) gaps.push("presenter");
  if (brief.valueLines.length === 0) gaps.push("valueLines");
  if (brief.programs.length === 0) gaps.push("programs");
  if (brief.guests.length === 0) gaps.push("guests");
  if (!brief.schedule.date.trim()) gaps.push("schedule.date");
  if (!brief.schedule.time.trim()) gaps.push("schedule.time");
  if (brief.schedule.venue === null) gaps.push("schedule.venue");
  if (brief.logos.length === 0) gaps.push("logos");
  if (brief.visuals.value === null) gaps.push("visuals.value");
  if (brief.bgm === null) gaps.push("bgm");
  return gaps;
}
