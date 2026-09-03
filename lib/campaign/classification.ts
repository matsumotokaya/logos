import type { UrlRegistrationScope } from "@/lib/brand-registration";
import type { BrandKit, CampaignBrandKit } from "./schema";

/**
 * The category a Brand wears. A label, not structure (v3 §19.2): it decides
 * nothing about where the Brand sits, and the user can change it afterwards.
 * `organization` exists because a workspace can hold a company's own Brand.
 */
export type BrandKind =
  | "organization"
  | "corporate"
  | "business"
  | "service"
  | "product"
  | "media"
  | "event";

export type SubjectCategory = {
  brandKind: BrandKind;
  confidence: "high" | "medium" | "low";
};

/**
 * Read the classifier's category, or fall back when it said nothing.
 *
 * The classifier used to decide `placement` too — whether the subject became
 * its own Brand or was folded into a parent's Work. v3 removed that: a
 * registered URL always yields exactly one Brand, so a misread category costs
 * a relabel rather than a missing page.
 */
export function resolveSubjectCategory(
  classification:
    | CampaignBrandKit["classification"]
    | BrandKit["classification"]
    | undefined,
  legacyScope?: UrlRegistrationScope,
): SubjectCategory {
  if (classification) {
    return {
      brandKind: classification.brand_kind,
      confidence: classification.confidence,
    };
  }
  return {
    brandKind: legacyScope === "organization" ? "corporate" : "business",
    confidence: "low",
  };
}
