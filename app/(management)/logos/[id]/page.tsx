import type { Metadata } from "next";
import LogoInfoPage from "@/app/brand/logos/[id]/page";

export const metadata: Metadata = {
  title: "ロゴ詳細・編集",
  robots: { index: false, follow: false },
};

export default function ManagedLogoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <LogoInfoPage params={params} embedded />;
}
