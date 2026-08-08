import type { BrandRecordStatus } from "@/lib/brand-hierarchy";

export type OrganizationKind = "company" | "individual" | "nonprofit" | "other";

export type OrganizationDetail = {
  id: string;
  name: string;
  organizationKind: OrganizationKind | null;
  website: string;
  industry: string;
  location: string;
  description: string;
  status: BrandRecordStatus;
  updatedAt: string;
  profile: {
    inheritsParent: boolean;
    status: BrandRecordStatus;
    value: Record<string, unknown>;
  } | null;
  businesses: Array<{
    id: string;
    name: string;
    website: string;
    status: BrandRecordStatus;
  }>;
  logos: Array<{
    id: string;
    title: string;
    role: string;
    visibility: string;
    previewUrl: string | null;
  }>;
  availableBusinesses: Array<{
    id: string;
    name: string;
    website: string;
    status: BrandRecordStatus;
    parentOrganization: {
      id: string;
      name: string;
    };
  }>;
};

export type OrganizationUpdate = Pick<
  OrganizationDetail,
  | "name"
  | "organizationKind"
  | "website"
  | "industry"
  | "location"
  | "description"
>;

export type BusinessDetail = {
  id: string;
  kind: "corporate" | "business" | "audience";
  name: string;
  website: string;
  industry: string;
  location: string;
  description: string;
  status: BrandRecordStatus;
  updatedAt: string;
  parentOrganization: {
    id: string;
    name: string;
  };
  profile: {
    inheritsParent: boolean;
    status: BrandRecordStatus;
    value: Record<string, unknown>;
  } | null;
  logos: Array<{
    id: string;
    title: string;
    role: string;
    visibility: string;
    previewUrl: string | null;
  }>;
  campaigns: Array<{
    id: string;
    jobId: string | null;
    name: string;
    status: string;
    createdAt: string;
  }>;
  audiences: Array<{
    id: string;
    name: string;
    status: BrandRecordStatus;
  }>;
  availableOrganizations: Array<{
    id: string;
    name: string;
    status: BrandRecordStatus;
  }>;
};

export type BusinessUpdate = Pick<
  BusinessDetail,
  "name" | "website" | "industry" | "location" | "description"
> & {
  parentOrganizationId: string;
};

export type BrandUrlInspection = {
  requestedUrl: string;
  finalUrl: string;
  name: string;
  organizationKind: OrganizationKind | null;
  industry: string;
  location: string;
  description: string;
  organizationHints: string[];
  evidence: string[];
  brandAssets: {
    palette: Record<string, string>;
    designTokens: {
      body_font: string | null;
      heading_font: string | null;
      button_radius: string | null;
      button_padding: string | null;
      section_spacing: string | null;
      container_width: string | null;
    } | null;
    logo: {
      data: string;
      mediaType: "image/png";
      sourceUrl: string;
    } | null;
  } | null;
};
