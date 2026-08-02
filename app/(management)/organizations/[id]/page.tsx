import type { Metadata } from "next";
import OrganizationDetailClient from "@/app/campaigns/organizations/[id]/OrganizationDetailClient";

export const metadata: Metadata = {
  title: "Organization詳細",
  robots: { index: false, follow: false },
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrganizationDetailClient id={id} />;
}
