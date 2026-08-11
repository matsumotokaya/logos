import type { Metadata } from "next";
import LpPortal from "./LpPortal";

export const metadata: Metadata = {
  title: "LP — ブランドアセット",
  robots: { index: false, follow: false },
};

export default async function BrandLpPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LpPortal brandId={id} />;
}