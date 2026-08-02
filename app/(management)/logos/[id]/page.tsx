import type { Metadata } from "next";
import PresentationPage from "@/app/p/[id]/page";

export const metadata: Metadata = {
  title: "ロゴプレゼンテーション",
  robots: { index: false, follow: false },
};

export default function ManagedLogoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PresentationPage params={params} embedded />;
}
