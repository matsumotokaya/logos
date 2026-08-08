import type { Metadata } from "next";
import PresentationPage from "@/app/p/[id]/page";

export const metadata: Metadata = {
  title: "ロゴプレゼンテーション編集",
  robots: { index: false, follow: false },
};

export default function ManagedLogoPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PresentationPage params={params} embedded editable />;
}
