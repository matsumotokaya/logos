import { z } from "zod";
import { EventBriefSchema } from "@/remotion/event/brief-schema";
import { CmVoiceTrackSchema } from "@/lib/templates/voice-schema";
import { EVENT_CM_SCENE_ROLES } from "./types";

// Runtime shape of an EventCmBrief. Like the event-promo schema this validates
// STRUCTURE, not completeness.
//
// The scene list is the one place with a real constraint, and it has two legal
// states rather than one:
//
//   0 scenes — not written yet. A seeded take is created before the narration
//              stage runs, and the goal reports the script as the one thing
//              still missing (lib/pipeline/event-cm.ts).
//   5 scenes — each role exactly once, in order. The composition picks a scene
//              component per role, so a script missing `cta` is not an
//              incomplete brief, it is a film with no ending.
//
// Anything between the two is a half-written script, which nothing produces on
// purpose and no renderer can use.

export const EventCmSceneSchema = z.object({
  role: z.enum(EVENT_CM_SCENE_ROLES),
  text: z.string(),
});

export const EventCmScriptSchema = z
  .object({
    version: z.literal(1),
    scenes: z.array(EventCmSceneSchema),
    source: z.enum(["llm", "human"]),
    updatedAt: z.string(),
    angle: z.string(),
  })
  .refine(
    (script) =>
      script.scenes.length === 0 ||
      (script.scenes.length === EVENT_CM_SCENE_ROLES.length &&
        script.scenes.every((scene, i) => scene.role === EVENT_CM_SCENE_ROLES[i])),
    {
      message: `scenes must be empty, or exactly ${EVENT_CM_SCENE_ROLES.join(" → ")}`,
    },
  );

export const EventCmProvenanceSchema = z.record(
  z.string(),
  z.object({
    origin: z.enum(["brand", "extracted", "inferred", "user"]),
    note: z.string().optional(),
    /** Which material this value was read out of, when it was extracted. */
    source: z.string().optional(),
  }),
);

export const EventCmThemeSchema = z.object({
  palette: z
    .object({
      primary: z.string().optional(),
      accent: z.string().optional(),
      background: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
  headingFont: z.string().nullable().optional(),
  bodyFont: z.string().nullable().optional(),
});

export const EventCmBriefSchema = EventBriefSchema.extend({
  provenance: EventCmProvenanceSchema.optional(),
  theme: EventCmThemeSchema.optional(),
  factsUpdatedAt: z.string().optional(),
  script: EventCmScriptSchema,
  voice: z
    .object({
      track: CmVoiceTrackSchema,
      audio: z.string().startsWith("material:"),
    })
    .optional(),
});

export type EventCmBriefInput = z.infer<typeof EventCmBriefSchema>;
