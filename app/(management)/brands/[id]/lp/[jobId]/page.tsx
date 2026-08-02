import type { Metadata } from "next";
import CampaignManagementPage from "@/app/(management)/campaigns/CampaignManagementPage";

export const metadata: Metadata = {
  title: "LP — ブランドアセット",
  robots: { index: false, follow: false },
};

export default async function BrandLpPage({
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
      view="lp"
      brandId={id}
    />
  );
}
