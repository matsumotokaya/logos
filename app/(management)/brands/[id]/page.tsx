import type { Metadata } from "next";
import BusinessDetailClient from "@/app/campaigns/businesses/[id]/BusinessDetailClient";

export const metadata: Metadata = {
  title: "ブランド詳細",
  robots: { index: false, follow: false },
};

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BusinessDetailClient id={id} />;
}
