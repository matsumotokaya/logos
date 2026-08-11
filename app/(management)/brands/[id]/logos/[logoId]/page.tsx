"use client";

// The brand-scoped logo detail page. Embeds the canonical LogoInfoPage so
// every edit surface — basic info, asset registry, presentation mapping —
// lives in one place. The brand id appears in breadcrumbs and as a return
// target; the global /logos/[id] route redirects here.

import { use } from "react";
import Link from "next/link";
import LogoInfoPage from "@/app/brand/logos/[id]/page";

export default function BrandLogoDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; logoId: string }>;
}) {
  // React.use() resolves the segment params. The page reads them only after
  // they are settled, so the embedded LogoInfoPage receives a stable id.
  const { brandId, logoId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-6 pt-6 text-xs text-ink-muted">
        <Link href={`/brands/${brandId}/logos`} className="hover:text-ink">
          ← ロゴ一覧
        </Link>
        <Link href={`/brands/${brandId}`} className="hover:text-ink">
          ブランドトップ
        </Link>
      </div>
      <LogoInfoPage
        params={Promise.resolve({ id: logoId })}
        embedded
      />
    </div>
  );
}