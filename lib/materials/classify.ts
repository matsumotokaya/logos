import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  categoryFromImageRole,
  isMaterialCategory,
  type MaterialCategory,
} from "./category";

// Writing the classification onto the material (docs/asset-normalization.md §14-2).
//
// The structuring run already decides what every image is. Until now that
// answer lived in take_runs.steps, so the next run re-decided it, the library
// could not be filtered by it, and another take could not inherit it. This is
// the step that moves the judgement from the record of a run to the thing being
// judged.
//
// Two rules, and they are the whole design:
//
//   A run may replace what a run decided.  (category_source = 'inferred')
//   A run may never replace what a person decided.  (category_source = 'user')
//
// The second is the same contract the scenario has with source='human', and it
// is what makes "決めつけて入れ、直せるようにする" safe: guessing is only
// acceptable when the guess can be corrected and the correction sticks.

export interface ImageClassification {
  materialId: string;
  /** The shared vocabulary, when the model answered it. */
  category?: MaterialCategory | string | null;
  /** The template's own word for the image, as the deterministic fallback. */
  role?: string | null;
}

export interface ClassificationOutcome {
  /** Materials whose category this run wrote. */
  applied: Array<{ materialId: string; category: MaterialCategory }>;
  /** Materials left alone because a person had already classified them. */
  keptByUser: string[];
  /** Materials the run could not classify at all. */
  unclassified: string[];
  /** Why a write did not land, when it did not. */
  note: string | null;
}

/**
 * Persist what one structuring run worked out about its images.
 *
 * Never throws: classification is an improvement to the library, not a
 * precondition for the film. A run that produced a good video must not fail
 * because a category could not be stored, so problems come back as `note`
 * for the run log to show.
 */
export async function storeImageClassifications(
  supabase: SupabaseClient,
  readings: readonly ImageClassification[],
): Promise<ClassificationOutcome> {
  const outcome: ClassificationOutcome = {
    applied: [],
    keptByUser: [],
    unclassified: [],
    note: null,
  };

  // Resolve each reading to a category first: the model's own answer when it
  // gave one, the template's word translated when it did not.
  const decided = new Map<string, MaterialCategory>();
  for (const reading of readings) {
    if (!reading.materialId) continue;
    const category = isMaterialCategory(reading.category)
      ? reading.category
      : categoryFromImageRole(reading.role);
    if (!category) {
      outcome.unclassified.push(reading.materialId);
      continue;
    }
    decided.set(reading.materialId, category);
  }
  if (decided.size === 0) return outcome;

  const ids = [...decided.keys()];
  const { data, error } = await supabase
    .from("brand_materials")
    .select("id, category, category_source")
    .in("id", ids);
  if (error) {
    return { ...outcome, note: `分類を保存できませんでした: ${error.message}` };
  }

  type Row = { id: string; category: string | null; category_source: string | null };
  const existing = new Map((data ?? []).map((row) => [(row as Row).id, row as Row]));

  for (const [materialId, category] of decided) {
    const row = existing.get(materialId);
    // A material the run cannot see is not an error worth stopping for: RLS or
    // a deletion between stages explains it, and the film is already made.
    if (!row) continue;
    if (row.category_source === "user") {
      outcome.keptByUser.push(materialId);
      continue;
    }
    // Already the same, by a run. Writing it again would only move updated_at.
    if (row.category === category) continue;

    const updated = await supabase
      .from("brand_materials")
      .update({ category, category_source: "inferred" })
      .eq("id", materialId)
      // Re-checked in the statement, not just above: another session may have
      // corrected this material while the run was thinking.
      .or("category_source.is.null,category_source.eq.inferred");
    if (updated.error) {
      outcome.note = `一部の分類を保存できませんでした: ${updated.error.message}`;
      continue;
    }
    outcome.applied.push({ materialId, category });
  }

  return outcome;
}
