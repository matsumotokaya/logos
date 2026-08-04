import type { Metadata } from "next";
import CampaignManagementPage from "../../CampaignManagementPage";

export const metadata: Metadata = {
  title: "LP — キャンペーン",
  robots: { index: false, follow: false },
};

export default function CampaignLpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <CampaignManagementPage
      params={params}
      view="lp"
    />
  );
}
