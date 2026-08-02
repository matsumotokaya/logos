import { cmVideoEmbed, renderLandingPage } from "@/lib/campaign/render-lp";
import {
  SAMPLE_CAMPAIGN_ID,
  SAMPLE_CM_VIDEO,
  sampleCampaignKit,
} from "@/lib/campaign/sample";
import CampaignDetail from "@/app/campaigns/[id]/CampaignDetail";

export default async function CampaignManagementPage({
  params,
  searchParams,
  view = "catalog",
  brandId = null,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generateVideo?: string | string[] }>;
  view?: "catalog" | "lp" | "video";
  brandId?: string | null;
}) {
  const { id } = await params;
  const query = await searchParams;
  const sampleHtml =
    id === SAMPLE_CAMPAIGN_ID
      ? renderLandingPage(sampleCampaignKit, {
          videoEmbed: cmVideoEmbed(SAMPLE_CM_VIDEO),
        })
      : null;

  return (
    <CampaignDetail
      id={id}
      sampleHtml={sampleHtml}
      autoGenerateCm={query.generateVideo === "1"}
      embedded
      view={view}
      brandId={brandId}
    />
  );
}
