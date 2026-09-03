import type { Metadata } from "next";
import BrandLpInfo from "./BrandLpInfo";

export const metadata: Metadata = {
  title: "LPの詳細 — ブランドアセット",
  robots: { index: false, follow: false },
};

export default async function BrandLpInfoPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id, jobId } = await params;
  return <BrandLpInfo brandId={id} takeId={jobId} />;
}
