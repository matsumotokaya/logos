import { z } from "zod";
import { EventBriefSchema } from "@/remotion/event/brief-schema";

// The brief schema of each template — the shape of the data that template needs.
//
// This is the "template-driven data collection" of the pivot made concrete: the
// schema decides what the collect/extract/structure stages have to produce, and
// a take stores the version it was validated against so a later schema change
// cannot retroactively invalidate what was already gathered.
//
// Kept apart from catalog.ts so client components can read template metadata
// without pulling zod and every schema into the browser bundle.

/**
 * product-cm and campaign-lp both consume the Service Brand Kit, which is
 * generated and stored by the campaign pipeline today. Their brief is therefore
 * a pointer to that job rather than the kit itself — copying the kit into the
 * take would create a second source of truth for the same bytes while the old
 * pipeline is still the one implementation (docs/schema-v2.md §16).
 */
export const CampaignKitBriefSchema = z.object({
  /** Immutable Kit snapshot; its generated copy stays inside the Take. */
  kit: z.unknown(),
  campaignJobId: z.string().uuid().nullable().optional(),
  sourceUrl: z.string().nullable(),
  /** Theme is a style choice inside the template, changeable after creation. */
  theme: z.string().nullable(),
});

export const BRIEF_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  "event-promo": EventBriefSchema,
  "product-cm": CampaignKitBriefSchema,
  "campaign-lp": CampaignKitBriefSchema,
};

export const briefSchema = (templateId: string): z.ZodType<unknown> | null =>
  BRIEF_SCHEMAS[templateId] ?? null;

export type BriefValidation =
  | { ok: true; brief: unknown }
  | { ok: false; issues: string[] };

/** Validate a brief against its template. Shape only — see brief-schema.ts on
 *  why an empty fact is not a validation failure. */
export function validateBrief(templateId: string, brief: unknown): BriefValidation {
  const schema = briefSchema(templateId);
  if (!schema) return { ok: false, issues: [`unknown template: ${templateId}`] };
  const parsed = schema.safeParse(brief);
  if (parsed.success) return { ok: true, brief: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}
