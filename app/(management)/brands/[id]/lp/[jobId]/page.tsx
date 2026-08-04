import type { Metadata } from "next";
import CampaignManagementPage from "@/app/(management)/campaigns/CampaignManagementPage";

export const metadata: Metadata = {
  title: "LP — ブランドアセット",
  robots: { index: false, follow: false },
};

export default async function BrandLpPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id, jobId } = await params;
  return (
    <CampaignManagementPage
      params={Promise.resolve({ id: jobId })}
      view="lp"
      brandId={id}
    />
  );
}
