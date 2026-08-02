import type { Metadata } from "next";
import CampaignManagementPage from "@/app/(management)/campaigns/CampaignManagementPage";

export const metadata: Metadata = {
  title: "動画 — ブランドアセット",
  robots: { index: false, follow: false },
};

export default async function BrandVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; jobId: string }>;
  searchParams: Promise<{ generateVideo?: string | string[] }>;
}) {
  const { id, jobId } = await params;
  return (
    <CampaignManagementPage
      params={Promise.resolve({ id: jobId })}
      searchParams={searchParams}
      view="video"
      brandId={id}
    />
  );
}
