import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignBrandKit } from "./schema";
import { organizationCatalogSeed } from "./catalog-seed";

type SeedKit = Pick<CampaignBrandKit, "service" | "organization">;

const service = {
  name: "WealthPark",
  tagline: "",
  description: "不動産領域のサービスを提供する企業です。",
  industry: "不動産テック",
  business_type: "web_service" as const,
  offering: "不動産関連サービス",
  audience: "不動産事業者",
  url: "https://wealth-park.com/ja/",
};

test("Organizationページの明示選択は、運営法人未確認よりページ名を優先する", () => {
  const kit: SeedKit = {
    service,
    organization: {
      name: "運営法人名は提供資料で未確認",
      organization_kind: "other",
      website: null,
      description: "正式名称を確認できません。",
      relationship: "unknown",
      confidence: "low",
      evidence: null,
    },
  };

  assert.deepEqual(
    organizationCatalogSeed(
      kit,
      "https://wealth-park.com/ja/?source=campaign#hero",
      "organization",
    ),
    {
      name: "WealthPark",
      website: "https://wealth-park.com/ja",
      description: "不動産領域のサービスを提供する企業です。",
      organizationKind: "other",
      nameSource: "page_classification",
    },
  );
});

test("事業ページでは根拠のある運営Organizationを使う", () => {
  const kit: SeedKit = {
    service,
    organization: {
      name: "WealthPark株式会社",
      organization_kind: "company",
      website: "https://wealth-park.com/company/",
      description: "WealthParkを運営する会社です。",
      relationship: "operated_by",
      confidence: "high",
      evidence: "会社概要に記載",
    },
  };

  const seed = organizationCatalogSeed(kit, service.url, "business");
  assert.equal(seed.name, "WealthPark株式会社");
  assert.equal(seed.website, "https://wealth-park.com/company");
  assert.equal(seed.organizationKind, "company");
  assert.equal(seed.nameSource, "operator_inference");
});

test("企業と事業の両方で運営名が不明ならページ名へフォールバックする", () => {
  const kit: SeedKit = { service, organization: undefined };
  const seed = organizationCatalogSeed(kit, service.url, "both");
  assert.equal(seed.name, "WealthPark");
  assert.equal(seed.nameSource, "page_classification");
});
