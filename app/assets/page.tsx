"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LOGO_ROLE_LABELS,
  VISIBILITY_LABELS,
  repo,
  type StoredLogo,
} from "@/lib/store";
import { svgToDataUri } from "@/lib/svg";
import AppHeader from "@/components/AppHeader";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
        {value}
      </p>
    </div>
  );
}

function AssetCard({ logo }: { logo: StoredLogo }) {
  return (
    <li className="border border-gray-200 bg-white">
      <Link
        href={`/assets/${logo.id}`}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <div className="flex aspect-[4/3] items-center justify-center bg-[#F1F3F4] p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgToDataUri(logo.data.svg)}
            alt=""
            className="max-h-full w-2/3 object-contain"
          />
        </div>
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium text-gray-900">
              {logo.title}
            </p>
            <p className="shrink-0 text-xs text-gray-400 tabular-nums">
              {formatDate(logo.updatedAt)}
            </p>
          </div>
          <p className="mt-2 truncate text-xs text-gray-500">
            {LOGO_ROLE_LABELS[logo.role]} / {VISIBILITY_LABELS[logo.visibility]}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="text-xs font-medium text-gray-900 underline underline-offset-2 group-hover:text-gray-600">
              アセット詳細
            </span>
            <span className="text-xs text-gray-500">/p/{logo.id}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function AssetsPage() {
  const [logos, setLogos] = useState<StoredLogo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo.listLogos().then((items) => {
      if (!cancelled) setLogos(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const items = logos ?? [];
    return {
      total: items.length,
      publicCount: items.filter((logo) => logo.visibility === "public").length,
      draftCount: items.filter((logo) => logo.visibility === "draft").length,
    };
  }, [logos]);

  return (
    <main className="min-h-dvh bg-[#F7F7F8] text-[#111827]">
      <AppHeader section="Assets" />

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:px-10">
        <div>
          <p className="text-xs text-gray-500">Assets</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">
            アセットライブラリ
          </h1>
        </div>

        {!logos ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-24 border border-gray-200 bg-white" />
            <div className="h-24 border border-gray-200 bg-white" />
            <div className="h-24 border border-gray-200 bg-white" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="登録アセット" value={stats.total} />
              <Stat label="公開中" value={stats.publicCount} />
              <Stat label="下書き" value={stats.draftCount} />
            </section>

            {logos.length === 0 ? (
              <section className="border border-dashed border-gray-300 bg-white p-8">
                <p className="max-w-prose text-pretty text-sm text-gray-500">
                  アセットがまだありません。トップページからSVGをアップロードすると、
                  ロゴ正本とプレゼンテーションが作成されます。
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-block text-sm text-gray-900 underline underline-offset-2"
                >
                  アップロードへ →
                </Link>
              </section>
            ) : (
              <section>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    すべてのアセット
                  </h2>
                  <p className="text-pretty text-xs text-gray-500">
                    ロゴ正本、主体entity、lockup / colorway、プレゼン構成を確認します。
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {logos.map((logo) => (
                    <AssetCard key={logo.id} logo={logo} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
