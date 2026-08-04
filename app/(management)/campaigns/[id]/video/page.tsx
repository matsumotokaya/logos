import type { Metadata } from "next";
import CampaignManagementPage from "../../CampaignManagementPage";

export const metadata: Metadata = {
  title: "動画 — キャンペーン",
  robots: { index: false, follow: false },
};

export default function CampaignVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <CampaignManagementPage
      params={params}
      view="video"
    />
  );
}
