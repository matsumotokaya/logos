"use client";

// The brand's top page, in the order the brand itself is built:
//
//   1. The pipeline that fills this brand — the five stages, opened over the
//      page rather than navigated to (§17.3)
//   2. The brand profile (name, description, industry, location, website)
//   3. **Brand assets**, shown two ways: DESIGN (palette / typography /
//      tokens, adopted into brand_knowledge_values) and LOGOS (all of them)
//   4. The marketing tools built out of those assets — videos, LPs, banners
//
// (3) and (4) are different kinds of thing and the page has to say so. A logo
// is not a deliverable sitting beside a video: it is global, like the palette,
// and every video, LP and banner is made out of it. Listing 動画 / LP / ロゴ as
// three peer tiles said the opposite.
//
// (1) is here because /businesses/[id] and /campaigns/businesses/[id] both
// redirect to this page: this IS the brand screen, and the pipeline has to be
// reachable from it. Re-fetching the site refreshes what the brand LOOKS like
// — palette, type, logo — and deliberately leaves its facts alone, since a
// name and description someone has confirmed should not be reverted by a
// crawl.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { videoFetch } from "@/lib/video/client";
import type { BrandOverview } from "@/app/api/brands/[id]/overview/route";
import type { LogoSummary } from "@/app/api/brands/[id]/logos/route";
import type { BrandUrlInspection } from "@/lib/brand-detail";
import PipelineBar from "@/components/pipeline/PipelineBar";
import StageDrawer from "@/components/pipeline/StageDrawer";
import BrandPipelinePanel, {
  type BrandPipelinePayload,
} from "@/components/pipeline/BrandPipelinePanel";
import type { BrandMaterial } from "@/components/pipeline/MaterialIntake";
import BrandAssetSlots from "@/components/brand/BrandAssetSlots";
import { materialFileName } from "@/lib/materials/naming";
import type { PipelineStage } from "@/lib/pipeline/stages";
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
  "palette.background": "背景色",
  "palette.surface": "面の色",
  "palette.text": "文字色",
  "palette.mode": "明暗",
  "palette.neutral": "ニュートラル",
  "palette.source": "パレットの出所",
  "typography.heading": "見出しフォント",
  "typography.body": "本文フォント",
  "typography.heading_font": "見出しフォント",
  "typography.body_font": "本文フォント",
  "typography.font_style": "書体の性格",
  "tokens.button_radius": "角の丸み",
  "tokens.button_padding": "ボタンの余白",
  "tokens.section_spacing": "セクション間の余白",
  "tokens.container_width": "コンテナ幅",
  "voice.tone": "声のトーン",
  "voice.guideline": "ライティング指針",
  "voice.tagline": "タグライン",
  "offering.name": "提供サービス名",
  "offering.summary": "提供内容の要約",
  "audience.primary": "主要な対象",
};

/** A hex value gets a swatch: a colour rule is unreadable as six characters. */
const HEX_VALUE = /^#[0-9a-f]{6}$/i;

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
  const [logos, setLogos] = useState<LogoSummary[]>([]);
  const [counts, setCounts] = useState({ videos: 0, lps: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<
    (BrandPipelinePayload & { stages: PipelineStage[] }) | null
  >(null);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [materials, setMaterials] = useState<BrandMaterial[]>([]);
  const [busy, setBusy] = useState(false);

  // The brand's key visual, if it has declared one.
  //
  // `kind` is where this lives rather than `category`, because `kind` has
  // carried role-ish values since 0028 — `logo` and `font` are roles too, and
  // `keyvisual` has been in the CHECK constraint all along with nothing
  // writing it. Reusing it costs no migration and invents no third axis.
  // `category` stays what the picture DEPICTS (a sake still life is a product
  // shot whether or not a brand made it their key visual).
  const keyVisuals = materials.filter((material) => material.kind === "keyvisual");

  const load = useCallback(async () => {
    try {
      const [overviewRes, videoRes, lpRes, logoRes] = await Promise.all([
        videoFetch(`/api/brands/${brandId}/overview`),
        videoFetch(`/api/brands/${brandId}/videos`),
        videoFetch(`/api/brands/${brandId}/lps`),
        videoFetch(`/api/brands/${brandId}/logos`),
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
      const logoJson = logoRes.ok
        ? ((await logoRes.json()) as { logos?: LogoSummary[] } | null)
        : null;
      setLogos(logoJson?.logos ?? []);
      setCounts({
        videos: videoJson?.videos?.length ?? 0,
        lps: lpJson?.lps?.length ?? 0,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ブランドトップを読み込めませんでした");
    }
  }, [brandId]);

  // The pipeline and the material list are derived from the same rows the page
  // reads, so they are refreshed by the same call that refreshes the page.
  const loadPipeline = useCallback(async () => {
    const [pipelineRes, materialsRes] = await Promise.all([
      videoFetch(`/api/brands/businesses/${brandId}/pipeline`),
      videoFetch(`/api/brands/businesses/${brandId}/materials`),
    ]);
    if (pipelineRes.ok) {
      const body = (await pipelineRes.json()) as {
        pipeline?: BrandPipelinePayload & { stages: PipelineStage[] };
      };
      if (body.pipeline) setPipeline(body.pipeline);
    }
    if (materialsRes.ok) {
      const body = (await materialsRes.json()) as { materials?: BrandMaterial[] };
      setMaterials(body.materials ?? []);
    }
  }, [brandId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await load();
      if (!cancelled) await loadPipeline();
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadPipeline]);

  /**
   * Re-read the brand's own site and adopt what it wears.
   *
   * One action, no confirmation step: the golden path is that nobody has to
   * choose anything. The result lands in the design-rules section below, where
   * it can be judged — and re-run — after the fact.
   */
  const reimportSite = useCallback(async () => {
    if (!overview?.website) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const inspectRes = await videoFetch("/api/brands/inspect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: overview.website, scope: "business" }),
      });
      const inspectBody = (await inspectRes.json().catch(() => null)) as {
        inspection?: BrandUrlInspection;
        error?: string;
      } | null;
      if (!inspectRes.ok || !inspectBody?.inspection) {
        throw new Error(inspectBody?.error ?? "サイトを読み取れませんでした");
      }
      const brandImport = inspectBody.inspection.brandAssets;
      if (!brandImport) {
        throw new Error("このサイトからは配色・書体・ロゴを取得できませんでした");
      }

      // The brand's facts are sent back unchanged. Only `brandImport` carries
      // anything new, and it is the only part the crawl is allowed to decide.
      const saveRes = await videoFetch(`/api/brands/businesses/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: overview.name,
          parentOrganizationId: overview.brandOrganizationId,
          website: overview.website,
          industry: overview.industry,
          location: overview.location,
          description: overview.description,
          brandImport,
        }),
      });
      const saveBody = (await saveRes.json().catch(() => null)) as {
        ok?: boolean;
        logo?: unknown;
        error?: string;
      } | null;
      if (!saveRes.ok || !saveBody?.ok) {
        throw new Error(saveBody?.error ?? "取り込んだ内容を保存できませんでした");
      }

      await load();
      await loadPipeline();
      setNotice(
        saveBody.logo
          ? "サイトから配色・書体・ロゴを取り込みました。"
          : "サイトから配色・書体を取り込みました。",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "サイトから取り込めませんでした");
    } finally {
      setBusy(false);
    }
  }, [brandId, load, loadPipeline, overview]);

  const uploadMaterial = useCallback(
    async (file: File, data: string) => {
      setBusy(true);
      try {
        await videoFetch(`/api/brands/businesses/${brandId}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: file.name, mediaType: file.type, data }),
        });
        await loadPipeline();
      } finally {
        setBusy(false);
      }
    },
    [brandId, loadPipeline],
  );

  const addNote = useCallback(
    async (text: string) => {
      setBusy(true);
      try {
        await videoFetch(`/api/brands/businesses/${brandId}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "メモ", text }),
        });
        await loadPipeline();
      } finally {
        setBusy(false);
      }
    },
    [brandId, loadPipeline],
  );

  const removeMaterial = useCallback(
    async (materialId: string) => {
      setBusy(true);
      try {
        await videoFetch(
          `/api/brands/businesses/${brandId}/materials/${materialId}`,
          { method: "DELETE" },
        );
        await loadPipeline();
      } finally {
        setBusy(false);
      }
    },
    [brandId, loadPipeline],
  );

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
  ];

  const kindLabel = BRAND_KIND_LABEL[overview.brandKind] ?? overview.brandKind;
  const visibleKnowledge = overview.knowledge
    .filter((k) => KNOWN_FIELDS[k.fieldPath] !== undefined || true)
    .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath));

  const openStageDef = pipeline?.stages.find((stage) => stage.id === openStage);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
      {pipeline ? (
        <div className="-mx-6 -mt-2 md:-mx-10">
          <PipelineBar
            stages={pipeline.stages}
            openStage={openStage}
            onOpenStage={setOpenStage}
          />
        </div>
      ) : null}
      {pipeline && openStageDef ? (
        <StageDrawer
          title={openStageDef.label}
          description={openStageDef.summary}
          onClose={() => setOpenStage(null)}
        >
          <BrandPipelinePanel
            stageId={openStageDef.id}
            payload={pipeline}
            onInject={() => {
              setOpenStage(null);
              void reimportSite();
            }}
            materials={{
              websiteLabel: overview.website || null,
              materials,
              busy,
              onUploadFile: uploadMaterial,
              onAddNote: addNote,
              onRemove: removeMaterial,
            }}
          />
        </StageDrawer>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-hairline bg-ink/[0.03] px-4 py-2.5 text-[12px] text-ink-muted">
          {notice}
        </p>
      ) : null}
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

      {/* Brand assets: global, and the material every tool below is made of.
          Two views of one thing — what it looks like, and what its mark is. */}
      <section aria-labelledby="brand-assets" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="brand-assets" className="text-balance text-lg font-semibold">
            ブランドアセット
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">
              動画・LP・バナーのすべてが、ここから作られます
            </span>
            {overview.website ? (
              <button
                type="button"
                onClick={() => void reimportSite()}
                disabled={busy}
                className="shrink-0 rounded-full border border-ink px-4 py-1.5 text-xs font-semibold transition hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-50"
              >
                {busy ? "取り込み中…" : "サイトから取り込む"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              デザイン
            </h3>
            <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
          </div>
          {visibleKnowledge.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleKnowledge.map((k) => {
                const value = formatKnowledgeValue(k.value);
                return (
                  <li
                    key={k.fieldPath}
                    className="rounded-2xl border border-hairline bg-white p-4"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      {KNOWN_FIELDS[k.fieldPath] ?? k.fieldPath}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-pretty text-sm font-semibold text-ink">
                      {HEX_VALUE.test(value) ? (
                        <span
                          aria-hidden="true"
                          className="inline-block h-4 w-4 shrink-0 rounded border border-hairline"
                          style={{ backgroundColor: value }}
                        />
                      ) : null}
                      {value}
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-ink-faint">
                      {k.fieldPath}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-sm text-ink-muted">
              まだ採用されたデザインルールはありません。
              {overview.website
                ? "「サイトから取り込む」でこのブランドのサイトを読み取ると、配色・書体・ロゴがここに入ります。"
                : "サイトURLを登録すると、そこから配色・書体・ロゴを取り込めます。"}
            </p>
          )}
        </div>

        {/* Logos and the key visual as NAMED SLOTS, so an empty one is
            visible. A brand with no key visual used to render no key-visual
            section at all, which reads as 「この製品にはその概念が無い」 rather
            than 「まだ指定していない」. Same component the video page uses, so
            the two answer the same question in the same shape. */}
        <BrandAssetSlots
          slots={[
            {
              key: "logo",
              label: "ロゴ",
              hint: "動画の冒頭と締め、LPのヘッダーに出ます",
              items: logos.map((logo) => ({
                id: logo.id,
                name: logo.title,
                previewUrl: logo.previewUrl,
                note: logo.subjectEntityName,
                href: `/brands/${brandId}/logos/${logo.id}`,
              })),
              emptyNote:
                "まだロゴがありません。サイトから取り込むか、トップからSVGをアップロードします。無いあいだは明朝のクレジット表記で代替されます。",
              href: `/brands/${brandId}/logos`,
            },
            {
              key: "keyvisual",
              label: "キービジュアル",
              hint: "動画の主役シーンやLPのヒーローの地になります",
              items: keyVisuals.map((material) => ({
                id: material.id,
                name: materialFileName(material),
                previewUrl: null,
                note: "ブランドの素材",
              })),
              emptyNote:
                "このブランドはキービジュアルを持っていません。成果物ごとに写真を入れるか、ずっと使う1枚を素材から「ブランドの基盤へ」上げると、ここに出ます。",
            },
          ]}
        />
      </section>

      {/* The tools built out of the assets above. */}
      <section aria-labelledby="brand-tools" className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 id="brand-tools" className="text-balance text-lg font-semibold">
            マーケティングツール
          </h2>
          <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {tiles.map((tile) => (
            <TileLink key={tile.href} tile={tile} />
          ))}
        </div>
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