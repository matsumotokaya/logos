"use client";

// The brand's top page. Three things belong here:
//
//   1. The brand profile (name, description, industry, location, website)
//   2. The brand's design rules — palette / typography / voice — adopted from
//      brand_knowledge_values so the next Take starts from what the team has
//      already decided
//   3. The three asset kinds this brand owns (videos, LPs, logos), each
//      rendered as a tile that opens the corresponding list
//
// The page deliberately mirrors a brand manager: profile above, assets below.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { videoFetch } from "@/lib/video/client";
import type { BrandOverview } from "@/app/api/brands/[id]/overview/route";
import { ADDABLE_VIDEO_TEMPLATES } from "@/lib/video/templates";

type Tile = {
  href: string;
  label: string;
  description: string;
  count: number;
  hint: string;
};

const BRAND_KIND_LABEL: Record<string, string> = {
  corporate: "企業",
  business: "事業",
  service: "サービス",
  product: "プロダクト",
  media: "メディア",
  event: "イベント",
  audience: "対象別",
};

// Map a brand_knowledge_values field path to a human label so the rendered
// card on the brand top is not a tree of dotted keys. The map only covers
// fields the product actually adopts today; unknown fields still render
// because the override is opt-in, not required.
const KNOWN_FIELDS: Record<string, string> = {
  "palette.primary": "プライマリカラー",
  "palette.accent": "アクセントカラー",
  "palette.neutral": "ニュートラル",
  "typography.heading": "見出しフォント",
  "typography.body": "本文フォント",
  "voice.tone": "声のトーン",
  "voice.guideline": "ライティング指針",
  "voice.tagline": "タグライン",
  "offering.name": "提供サービス名",
  "offering.summary": "提供内容の要約",
  "audience.primary": "主要な対象",
};

function formatKnowledgeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" / ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.hex === "string") return obj.hex;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function BrandTop({ brandId }: { brandId: string }) {
  const [overview, setOverview] = useState<BrandOverview | null>(null);
  const [counts, setCounts] = useState({ videos: 0, lps: 0 });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRes, videoRes, lpRes] = await Promise.all([
        videoFetch(`/api/brands/${brandId}/overview`),
        videoFetch(`/api/brands/${brandId}/videos`),
        videoFetch(`/api/brands/${brandId}/lps`),
      ]);
      const overviewJson = overviewRes.ok
        ? ((await overviewRes.json()) as { overview?: BrandOverview } | null)
        : null;
      const videoJson = videoRes.ok
        ? ((await videoRes.json()) as { videos?: unknown[] } | null)
        : null;
      const lpJson = lpRes.ok
        ? ((await lpRes.json()) as { lps?: unknown[] } | null)
        : null;

      if (!overviewJson?.overview) {
        throw new Error("ブランド情報を取得できませんでした");
      }
      setOverview(overviewJson.overview);
      setCounts({
        videos: videoJson?.videos?.length ?? 0,
        lps: lpJson?.lps?.length ?? 0,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ブランドトップを読み込めませんでした");
    }
  }, [brandId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!overview) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
        <p className="text-sm text-ink-muted">読み込み中…</p>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  const tiles: Tile[] = [
    {
      href: `/brands/${brandId}/video`,
      label: "動画",
      description: "テンプレートを選んで追加できます。",
      count: counts.videos,
      hint: ADDABLE_VIDEO_TEMPLATES.find((t) => t.id === "event-promo")?.name ?? "",
    },
    {
      href: `/brands/${brandId}/lp`,
      label: "LP",
      description: "Brand Kitから組み立てたセールスページの一覧。",
      count: counts.lps,
      hint: "セールスページ",
    },
    {
      href: `/brands/${brandId}/logos`,
      label: "ロゴ",
      description: "Organization配下のロゴ一覧。プレゼンの編集へ。",
      count: 0,
      hint: "ロゴ一覧",
    },
  ];

  const kindLabel = BRAND_KIND_LABEL[overview.brandKind] ?? overview.brandKind;
  const visibleKnowledge = overview.knowledge
    .filter((k) => KNOWN_FIELDS[k.fieldPath] !== undefined || true)
    .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
      <header className="border-b border-hairline pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-xs font-semibold text-ink-muted">BRAND</p>
          {kindLabel ? (
            <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted">
              {kindLabel}
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-balance font-display text-3xl font-semibold">
          {overview.name}
        </h1>
        <p className="mt-3 text-pretty text-sm text-ink-muted">
          {overview.description
            ? overview.description
            : "このブランドのプロフィール・デザインルール・アセットの一覧です。"}
        </p>
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          {overview.industry ? (
            <div>
              <dt className="text-ink-faint">業種</dt>
              <dd className="mt-1 text-ink">{overview.industry}</dd>
            </div>
          ) : null}
          {overview.location ? (
            <div>
              <dt className="text-ink-faint">所在地</dt>
              <dd className="mt-1 text-ink">{overview.location}</dd>
            </div>
          ) : null}
          {overview.website ? (
            <div>
              <dt className="text-ink-faint">Webサイト</dt>
              <dd className="mt-1 truncate">
                <a
                  href={overview.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {overview.website}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      <section aria-labelledby="brand-knowledge" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="brand-knowledge" className="text-balance text-lg font-semibold">
            ブランドアセット
          </h2>
          <span className="text-xs text-ink-muted">
            配色・フォント・声のトーンなど、このブランド全体に効くルール
          </span>
        </div>
        {visibleKnowledge.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleKnowledge.map((k) => (
              <li
                key={k.fieldPath}
                className="rounded-2xl border border-hairline bg-white p-4"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {KNOWN_FIELDS[k.fieldPath] ?? k.fieldPath}
                </p>
                <p className="mt-2 text-pretty text-sm font-semibold text-ink">
                  {formatKnowledgeValue(k.value)}
                </p>
                <p className="mt-2 font-mono text-[10px] text-ink-faint">
                  {k.fieldPath}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-sm text-ink-muted">
            まだadoptされたデザインルールはありません。トップのCM MakerでBrand Kitを生成すると、ここに整理されます。
          </p>
        )}
      </section>

      <section
        aria-label="このブランドのアセット"
        className="grid gap-4 md:grid-cols-3"
      >
        {tiles.map((tile) => (
          <TileLink key={tile.href} tile={tile} />
        ))}
      </section>
    </main>
  );
}

function TileLink({ tile }: { tile: Tile }) {
  return (
    <Link
      href={tile.href}
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-hairline bg-white p-5 transition",
        "hover:border-ink hover:bg-ink/[0.02]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-balance text-lg font-semibold">{tile.label}</span>
        {tile.count > 0 ? (
          <span className="tabular-nums text-2xl font-semibold text-ink">
            {tile.count}
          </span>
        ) : null}
      </span>
      <p className="text-pretty text-xs leading-relaxed text-ink-muted">
        {tile.description}
      </p>
      <span className="mt-auto flex items-center justify-between text-[11px] text-ink-muted">
        <span>{tile.hint}</span>
        <span className="text-accent">開く →</span>
      </span>
    </Link>
  );
}