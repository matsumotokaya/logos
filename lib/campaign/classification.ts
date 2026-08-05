import type { UrlRegistrationScope } from "@/lib/brand-registration";
import type { BrandKit, CampaignBrandKit } from "./schema";

export type BrandKind =
  | "corporate"
  | "business"
  | "service"
  | "product"
  | "media"
  | "event";

export type SubjectPlacement = {
  brandKind: BrandKind;
  placement: "brand" | "work";
  confidence: "high" | "medium" | "low";
};

/** Normalize new LLM output while preserving old jobs that used the dialog. */
export function resolveSubjectPlacement(
  classification:
    | CampaignBrandKit["classification"]
    | BrandKit["classification"]
    | undefined,
  legacyScope?: UrlRegistrationScope,
): SubjectPlacement {
  if (classification) {
    return {
      brandKind: classification.brand_kind,
      placement:
        classification.brand_kind === "corporate"
          ? "brand"
          : classification.placement,
      confidence: classification.confidence,
    };
  }
  return {
    brandKind: legacyScope === "organization" ? "corporate" : "business",
    placement: "brand",
    confidence: "low",
  };
}
