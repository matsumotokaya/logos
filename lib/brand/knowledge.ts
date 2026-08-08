import type { SupabaseClient } from "@supabase/supabase-js";

export interface KnowledgeValueRow {
  brand_id: string;
  field_path: string;
  value: unknown;
}

export interface AdoptKnowledgeField {
  field_path: string;
  layer: "fact" | "expression";
  value: unknown;
}

export interface AppendKnowledgeField {
  field_path: string;
  layer: "fact" | "expression";
  value: unknown;
  confidence: "confirmed" | "evidenced" | "inferred" | "unknown" | "suggested" | "adopted";
}

const PROFILE_PATHS: Record<string, [string, string] | [string]> = {
  "identity.legal_name": ["organization", "name"],
  "identity.description": ["organization", "description"],
  "identity.organization_kind": ["organization", "organization_kind"],
  "identity.relationship": ["organization", "relationship"],
  "contact.website": ["service", "url"],
  "offering.name": ["service", "name"],
  "offering.tagline": ["service", "tagline"],
  "offering.description": ["service", "description"],
  "offering.industry": ["service", "industry"],
  "offering.business_type": ["service", "business_type"],
  "offering.audience": ["service", "audience"],
  "offering.summary": ["service", "offering"],
  "palette.primary": ["palette", "primary"],
  "palette.accent": ["palette", "accent"],
  "palette.background": ["palette", "background"],
  "palette.surface": ["palette", "surface"],
  "palette.text": ["palette", "text"],
  "palette.mode": ["palette", "mode"],
  "palette.source": ["palette", "palette_source"],
  "typography.font_style": ["palette", "font_style"],
  "typography.body_font": ["design_tokens", "body_font"],
  "typography.heading_font": ["design_tokens", "heading_font"],
  "tokens.button_radius": ["design_tokens", "button_radius"],
  "tokens.button_padding": ["design_tokens", "button_padding"],
  "tokens.section_spacing": ["design_tokens", "section_spacing"],
  "tokens.container_width": ["design_tokens", "container_width"],
  "tone.theme": ["theme"],
};

export function mergeProfile(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      current &&
      value &&
      typeof current === "object" &&
      typeof value === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(value)
        ? mergeProfile(
            current as Record<string, unknown>,
            value as Record<string, unknown>,
          )
        : value;
  }
  return merged;
}

export function profileFromKnowledge(
  rows: Pick<KnowledgeValueRow, "field_path" | "value">[],
): Record<string, unknown> {
  const profile: Record<string, unknown> = {};
  for (const row of rows) {
    const path = PROFILE_PATHS[row.field_path];
    if (!path) continue;
    if (path.length === 1) {
      profile[path[0]] = row.value;
      continue;
    }
    const [group, field] = path;
    const current =
      profile[group] && typeof profile[group] === "object"
        ? (profile[group] as Record<string, unknown>)
        : {};
    current[field] = row.value;
    profile[group] = current;
  }
  return profile;
}

export async function knowledgeProfilesByBrand(
  supabase: SupabaseClient,
  brandIds: string[],
): Promise<{ data: Map<string, Record<string, unknown>>; error: string | null }> {
  const result = new Map<string, Record<string, unknown>>();
  if (brandIds.length === 0) return { data: result, error: null };

  const { data, error } = await supabase
    .from("brand_knowledge_values")
    .select("brand_id, field_path, value")
    .in("brand_id", brandIds)
    .is("variant_id", null);
  if (error) return { data: result, error: error.message };

  const grouped = new Map<string, KnowledgeValueRow[]>();
  for (const row of (data ?? []) as KnowledgeValueRow[]) {
    const current = grouped.get(row.brand_id) ?? [];
    current.push(row);
    grouped.set(row.brand_id, current);
  }
  for (const [brandId, rows] of grouped) {
    result.set(brandId, profileFromKnowledge(rows));
  }
  return { data: result, error: null };
}

export async function adoptBrandKnowledge(
  supabase: SupabaseClient,
  input: {
    brandId: string;
    fields: AdoptKnowledgeField[];
    sourceKind: "user_input" | "url_extraction" | "file_extraction";
    sourceRef?: Record<string, unknown>;
    userId: string;
  },
): Promise<{ ok: true; adopted: number } | { ok: false; error: string }> {
  if (input.fields.length === 0) return { ok: true, adopted: 0 };
  const { data, error } = await supabase.rpc("adopt_brand_knowledge", {
    p_brand_id: input.brandId,
    p_fields: input.fields,
    p_source_kind: input.sourceKind,
    p_source_ref: input.sourceRef ?? {},
    p_user_id: input.userId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, adopted: Number(data ?? 0) };
}

/** Append generation/extraction observations without silently adopting them as
 * canonical Brand values. A retry of the same source only fills missing paths. */
export async function appendBrandKnowledgeClaims(
  supabase: SupabaseClient,
  input: {
    brandId: string;
    fields: AppendKnowledgeField[];
    sourceKind:
      | "user_input"
      | "url_extraction"
      | "file_extraction"
      | "llm_structuring"
      | "llm_generation"
      | "derived"
      | "render_output";
    sourceRef: Record<string, unknown>;
    userId: string;
    runId?: string | null;
  },
): Promise<{ ok: true; appended: number } | { ok: false; error: string }> {
  const fields = input.fields.filter((field) => field.value != null);
  if (fields.length === 0) return { ok: true, appended: 0 };

  const paths = fields.map((field) => field.field_path);
  const { data: existing, error: readError } = await supabase
    .from("brand_knowledge_claims")
    .select("field_path")
    .eq("brand_id", input.brandId)
    .eq("source_kind", input.sourceKind)
    .contains("source_ref", input.sourceRef)
    .in("field_path", paths);
  if (readError) return { ok: false, error: readError.message };

  const recorded = new Set((existing ?? []).map((row) => row.field_path as string));
  const missing = fields.filter((field) => !recorded.has(field.field_path));
  if (missing.length === 0) return { ok: true, appended: 0 };

  const { error } = await supabase.from("brand_knowledge_claims").insert(
    missing.map((field) => ({
      brand_id: input.brandId,
      field_path: field.field_path,
      layer: field.layer,
      value: field.value,
      confidence: field.confidence,
      source_kind: input.sourceKind,
      source_ref: input.sourceRef,
      recorded_by: input.userId,
      run_id: input.runId ?? null,
    })),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, appended: missing.length };
}
