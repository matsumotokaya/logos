import type { Metadata } from "next";
import CampaignManagementPage from "../../CampaignManagementPage";

export const metadata: Metadata = {
  title: "動画 — キャンペーン",
  robots: { index: false, follow: false },
};

export default function CampaignVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generateVideo?: string | string[] }>;
}) {
  return (
    <CampaignManagementPage
      params={params}
      searchParams={searchParams}
      view="video"
    />
  );
}
