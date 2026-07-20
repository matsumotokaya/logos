// /campaigns/[id] — one campaign's home: sidebar campaign list on the left,
// the expanded campaign (digest + process log) on the right. The bundled
// sample lives at /campaigns/sample; its LP is rendered server-side so the
// page works without any API access.

import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import { cmVideoEmbed, renderLandingPage } from "@/lib/campaign/render-lp";
import {
  SAMPLE_CAMPAIGN_ID,
  SAMPLE_CM_VIDEO,
  sampleCampaignKit,
} from "@/lib/campaign/sample";
import CampaignDetail from "./CampaignDetail";

export const metadata: Metadata = {
  title: "Campaign — CM Maker",
  robots: { index: false, follow: false },
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sampleHtml =
    id === SAMPLE_CAMPAIGN_ID
      ? renderLandingPage(sampleCampaignKit, {
          videoEmbed: cmVideoEmbed(SAMPLE_CM_VIDEO),
        })
      : null;

  return (
    <div className="min-h-dvh flex-1 bg-paper text-ink">
      <AppHeader section="Campaigns" />
      <CampaignDetail id={id} sampleHtml={sampleHtml} />
    </div>
  );
}
