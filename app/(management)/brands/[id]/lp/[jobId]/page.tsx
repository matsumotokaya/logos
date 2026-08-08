import type { Metadata } from "next";
import BrandLpDetail from "./BrandLpDetail";

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
  return <BrandLpDetail brandId={id} resourceId={jobId} />;
}
