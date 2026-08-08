export type BrandEntityKind =
  | "corporate"
  | "business"
  | "service"
  | "product"
  | "media"
  | "event"
  | "audience";
export type BrandRecordStatus = "inferred" | "confirmed" | "archived";

export type BrandAssetKind =
  | "logo"
  | "guideline"
  | "lp"
  | "narration"
  | "audio"
  | "video"
  | "banner"
  | "mockup"
  | "document"
  | "other";

export type BrandAssetSummary = {
  id: string;
  kind: BrandAssetKind;
  title: string;
  status: "pending" | "ready" | "failed" | "archived";
  publicPath: string | null;
  generationRunId: string | null;
  jobId: string | null;
  createdAt: string;
};

export type BrandCampaignSummary = {
  id: string;
  /** Local generation job that supplied this campaign Take, when present. */
  jobId: string | null;
  name: string;
  status: "running" | "draft" | "published" | "failed" | "archived";
  logoId: string | null;
  primary: string | null;
  accent: string | null;
  createdAt: string;
  lpUrl: string;
  videoStatus: "not_created" | "preview_ready" | "mp4_ready";
};

export type BrandLogoSummary = {
  id: string;
  title: string;
  role: string;
  visibility: string;
  subjectEntityId: string;
  subjectEntityName: string;
  inherited: boolean;
};

export type BrandSummary = {
  id: string;
  organizationId: string;
  parentBrandId: string | null;
  kind: BrandEntityKind;
  isPrimary: boolean;
  name: string;
  website: string;
  industry: string;
  description: string;
  status: BrandRecordStatus;
  primary: string | null;
  accent: string | null;
  fontStyle: string | null;
  logos: BrandLogoSummary[];
  logoIds: string[];
  assets: BrandAssetSummary[];
  campaigns: BrandCampaignSummary[];
};

/** @deprecated Transitional alias while the remaining business routes move. */
export type BrandBusinessSummary = BrandSummary;

export type BrandOrganizationSummary = {
  id: string;
  name: string;
  organizationKind: "company" | "individual" | "nonprofit" | "other" | null;
  website: string;
  description: string;
  status: BrandRecordStatus;
  logos: BrandLogoSummary[];
  brands: BrandSummary[];
  /** @deprecated Transitional alias for older campaign intake components. */
  businesses: BrandBusinessSummary[];
};
