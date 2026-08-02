import type { UrlRegistrationScope } from "@/lib/brand-registration";
import type { CampaignBrandKit } from "./schema";

const UNKNOWN_ORGANIZATION_NAME = /(未確認|不明|特定でき|確認でき)/;

export function normalizedCatalogWebsite(
  value: string | null | undefined,
): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

function usableOrganizationName(value: string | null | undefined): string {
  const name = value?.trim() ?? "";
  return name && !UNKNOWN_ORGANIZATION_NAME.test(name) ? name : "";
}

export type OrganizationCatalogSeed = {
  name: string;
  website: string;
  description: string;
  organizationKind: "company" | "individual" | "nonprofit" | "other";
  nameSource: "page_classification" | "operator_inference" | "service_fallback";
};

/**
 * Resolve the real-world Organization represented by a new campaign URL.
 *
 * `kit.organization` describes an inferred operator. When the user explicitly
 * classified the URL itself as an Organization page, the page/service identity
 * is stronger evidence than a low-confidence "operator unknown" result.
 */
export function organizationCatalogSeed(
  kit: Pick<CampaignBrandKit, "service" | "organization">,
  sourceUrl: string | null,
  registrationScope: UrlRegistrationScope,
): OrganizationCatalogSeed {
  const inferred = kit.organization;
  const inferredName = usableOrganizationName(inferred?.name);
  const pageIsOrganization = registrationScope === "organization";
  const bothWithoutOperator = registrationScope === "both" && !inferredName;

  if (pageIsOrganization || bothWithoutOperator) {
    return {
      name: kit.service.name.trim() || "名称未設定のOrganization",
      website: normalizedCatalogWebsite(
        kit.service.url ?? sourceUrl,
      ),
      description: kit.service.description,
      organizationKind: inferred?.organization_kind ?? "other",
      nameSource: "page_classification",
    };
  }

  if (inferredName) {
    return {
      name: inferredName,
      website:
        normalizedCatalogWebsite(inferred?.website) ||
        (registrationScope === "business"
          ? ""
          : normalizedCatalogWebsite(sourceUrl)),
      description: inferred?.description ?? "",
      organizationKind: inferred?.organization_kind ?? "other",
      nameSource: "operator_inference",
    };
  }

  return {
    name: `${kit.service.name.trim() || "名称未設定"} 運営組織（未確認）`,
    website:
      registrationScope === "business"
        ? ""
        : normalizedCatalogWebsite(sourceUrl),
    description: inferred?.description ?? "",
    organizationKind: inferred?.organization_kind ?? "other",
    nameSource: "service_fallback",
  };
}
