"use client";

// LP list for one brand — every campaign-lp Take this brand has. The detail
// page is /brands/[id]/lp/[takeId] (BrandLpDetail) and the API sits at
// /api/brands/[id]/lps. Today this view is read-only — adding a new LP still
// happens through the campaign pipeline and the existing top-page flow.
//
// The list deliberately mirrors the video portal's structure so the two
// siblings feel like the same kind of thing at different scales.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { videoFetch } from "@/lib/video/client";
import type { LpSummary } from "@/app/api/brands/[id]/lps/route";

const LP_STATE_LABEL: Record<LpSummary["state"], string> = {
  html_ready: "ページ作成済み",
  preview_ready: "プレビュー可能",
  empty: "未作成",
};

export default function LpPortal({ brandId }: { brandId: string }) {
  const [lps, setLps] = useState<LpSummary[] | null>(null);
  const [brandName, setBrandName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await videoFetch(`/api/brands/${brandId}/lps`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "LPを取得できませんでした");
      }
      const json = (await res.json()) as {
        brand: { id: string; name: string };
        lps: LpSummary[];
      };
      setLps(json.lps);
      setBrandName(json.brand.name);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LPを取得できませんでした");
      setLps([]);
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

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-muted">LP</p>
          <h1 className="mt-2 text-balance font-display text-3xl font-semibold">
            {brandName ? `${brandName}のLP` : "LP"}
          </h1>
          <p className="mt-3 text-pretty text-sm text-ink-muted">
            このブランドが持つセールスページの一覧です。トップのCM Makerでソースから生成されたBrand Kitから組み立てます。
          </p>
        </div>
        <Link
          href={`/brands/${brandId}`}
          className="text-xs text-ink-muted underline-offset-4 hover:text-ink"
        >
          ← ブランドトップ
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}

      {lps === null ? (
        <p className="text-sm text-ink-muted">読み込み中…</p>
      ) : lps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hairline px-5 py-6 text-sm text-ink-muted">
          このブランドのLPはまだありません。
          <Link href="/" className="ml-1 underline-offset-4 hover:text-ink">
            CM Maker
          </Link>
          でソースからBrand Kitを作って「LP化する」を選ぶと、ここに表示されます。
        </p>
      ) : (
        <ul className="space-y-3">
          {lps.map((lp) => (
            <li key={lp.id}>
              <LpRow brandId={brandId} lp={lp} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function LpRow({ brandId, lp }: { brandId: string; lp: LpSummary }) {
  return (
    <Link
      href={`/brands/${brandId}/lp/${lp.id}`}
      className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline px-5 py-4 transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{lp.title}</span>
          {lp.theme ? (
            <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-muted">
              {lp.theme}
            </span>
          ) : null}
          {lp.published ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
              公開中
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block text-[11px] text-ink-muted">
          {LP_STATE_LABEL[lp.state]}
          {!lp.hasSource ? " ・ ソース未登録" : null}
        </span>
      </span>
      <span className="text-xs text-accent">開く →</span>
    </Link>
  );
}