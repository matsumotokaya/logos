import type { Metadata } from "next";
import CampaignManagementPage from "../CampaignManagementPage";

export const metadata: Metadata = {
  title: "キャンペーン詳細",
  robots: { index: false, follow: false },
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignManagementPage params={params} />;
}
