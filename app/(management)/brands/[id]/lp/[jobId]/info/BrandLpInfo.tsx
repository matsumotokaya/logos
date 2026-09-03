"use client";

// The text page about an LP: template and version, artifact size, preview and
// public URLs, publication history. Read-only. The LP itself (the preview and
// the publish switch) is one level up; this page is reached from the sidebar
// row menu (「詳細」).

import { useEffect, useState } from "react";
import { authedFetch } from "@/app/campaigns/campaign-ui";
import InfoPage, { formatBytes, formatDateTime, type InfoRow } from "@/components/management/InfoPage";

interface LpFacts {
  id: string;
  brandId: string;
  title: string;
  serviceName: string;
  templateId: string;
  templateVersion: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  render: { id: string; status: string; updatedAt: string };
  artifact: { id: string; bytes: number; mediaType: string; createdAt: string } | null;
  previewUrl: string | null;
  published: boolean;
  publicUrl: string | null;
  publishedAt: string | null;
  publicationHistoryCount: number;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "legacy" }
  | { kind: "error"; message: string }
  | { kind: "ready"; lp: LpFacts };

export default function BrandLpInfo({
  brandId,
  takeId,
}: {
  brandId: string;
  takeId: string;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authedFetch(`/api/brands/${brandId}/lps/${takeId}`);
        if (response.status === 404) {
          if (!cancelled) setState({ kind: "legacy" });
          return;
        }
        const body = (await response.json().catch(() => null)) as
          | { lp?: LpFacts; error?: string }
          | null;
        if (!response.ok || !body?.lp) {
          throw new Error(body?.error ?? "LPを読み込めませんでした");
        }
        if (!cancelled) setState({ kind: "ready", lp: body.lp });
      } catch (error) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "LPを読み込めませんでした",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, takeId]);

  const bodyPath = `/brands/${brandId}/lp/${takeId}`;

  if (state.kind !== "ready") {
    return (
      <InfoPage
        kindLabel="LP"
        title={
          state.kind === "error"
            ? "LPを開けませんでした"
            : state.kind === "legacy"
              ? "旧形式のLP"
              : "読み込み中…"
        }
        bodyHref={bodyPath}
        bodyLabel="LPを開く"
        brandId={brandId}
        error={
          state.kind === "error"
            ? state.message
            : state.kind === "legacy"
              ? "旧job IDのLPには詳細がありません。LP本体は従来の画面で開けます。"
              : null
        }
        sections={[]}
      />
    );
  }

  const { lp } = state;
  const sections: { title: string; rows: InfoRow[] }[] = [
    {
      title: "仕様",
      rows: [
        { label: "サービス名", value: lp.serviceName },
        { label: "テンプレート", value: `${lp.templateId}@${lp.templateVersion}`, mono: true },
        { label: "状態", value: lp.status },
        { label: "作成", value: formatDateTime(lp.createdAt) },
        { label: "更新", value: formatDateTime(lp.updatedAt) },
      ],
    },
    {
      title: "生成物",
      rows: [
        { label: "レンダー", value: lp.render.status },
        { label: "HTML", value: lp.artifact ? formatBytes(lp.artifact.bytes) : "未生成" },
        { label: "形式", value: lp.artifact?.mediaType ?? null },
        { label: "生成日時", value: formatDateTime(lp.artifact?.createdAt ?? null) },
        {
          label: "private preview",
          value: lp.previewUrl ? "開く ↗" : null,
          href: lp.previewUrl ?? undefined,
        },
      ],
    },
    {
      title: "公開",
      rows: [
        { label: "状態", value: lp.published ? "公開中" : "非公開" },
        { label: "公開URL", value: lp.publicUrl, href: lp.publicUrl ?? undefined },
        { label: "公開日時", value: formatDateTime(lp.publishedAt) },
        { label: "公開履歴", value: `${lp.publicationHistoryCount}件` },
      ],
    },
    {
      title: "識別子",
      rows: [
        { label: "Take ID", value: lp.id, mono: true },
        { label: "Render ID", value: lp.render.id, mono: true },
      ],
    },
  ];

  return (
    <InfoPage
      kindLabel="LP"
      title={lp.title}
      bodyHref={bodyPath}
      bodyLabel="LPを開く"
      brandId={brandId}
      sections={sections}
    />
  );
}
