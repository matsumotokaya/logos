"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { BusinessDetail } from "@/lib/brand-detail";
import { refreshBrandTree } from "@/lib/brand-events";
import { analyzeSvg } from "@/lib/svg";
import {
  LOGO_ROLE_LABELS,
  VISIBILITY_LABELS,
  type LogoRole,
  type LogoVisibility,
} from "@/lib/store/types";
import { authedFetch } from "../../campaign-ui";

type BrandLogo = BusinessDetail["logos"][number];

const ROLE_OPTIONS: LogoRole[] = [
  "brand",
  "corporate",
  "service",
  "subsidiary",
  "other",
];

export default function BrandLogoAssets({
  brandId,
  brandName,
  brandKind,
  logos,
  onLogoCreated,
}: {
  brandId: string;
  brandName: string;
  brandKind: BusinessDetail["kind"];
  logos: BrandLogo[];
  onLogoCreated: (logo: BrandLogo) => void;
}) {
  const defaultRole: LogoRole =
    brandKind === "corporate" ? "corporate" : "brand";
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(brandName);
  const [role, setRole] = useState<LogoRole>(defaultRole);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const resetForm = () => {
    setTitle(brandName);
    setRole(defaultRole);
    setFile(null);
    setError(null);
  };

  const cancel = () => {
    resetForm();
    setAdding(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) {
      setError("SVGファイルを選択してください。");
      return;
    }

    setSubmitting(true);
    try {
      const source = await file.text();
      const data = analyzeSvg(source, file.name);
      const { svg, ...analysis } = data;
      const response = await authedFetch(`/api/brands/${brandId}/logos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, role, svg, analysis }),
      });
      const body = (await response.json().catch(() => null)) as {
        logo?: BrandLogo & { takeId: string };
        error?: string;
      } | null;
      if (!response.ok || !body?.logo) {
        throw new Error(body?.error ?? "ロゴを登録できませんでした");
      }
      onLogoCreated(body.logo);
      refreshBrandTree();
      resetForm();
      setAdding(false);
      setNotice(
        "ロゴを登録し、ロゴプレゼンテーションを作成しました。",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "ロゴを登録できませんでした",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-hairline p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-balance text-lg font-semibold">ロゴ</h2>
          <p className="mt-1 text-pretty text-xs text-ink-muted">
            SVGを登録すると、編集可能なロゴプレゼンも同時に作成されます。
          </p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setNotice(null);
            }}
            className="rounded-full border border-ink px-4 py-2 text-xs font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            ロゴを追加
          </button>
        ) : null}
      </div>

      {adding ? (
        <form onSubmit={submit} className="mt-5 rounded-xl bg-ink/[0.03] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold">ロゴ名</span>
              <input
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </label>
            <label>
              <span className="text-xs font-semibold">種類</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as LogoRole)}
                className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {LOGO_ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold">SVGファイル</span>
              <input
                required
                type="file"
                accept="image/svg+xml,.svg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink"
              />
            </label>
          </div>
          {error ? (
            <p className="mt-3 text-pretty text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={submitting}
              className="rounded-full px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !file}
              className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
            >
              {submitting ? "登録しています…" : "ロゴを登録"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-5" aria-live="polite">
        {notice ? (
          <p className="mb-4 text-pretty text-xs text-emerald-700">{notice}</p>
        ) : null}
        {logos.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {logos.map((logo) => (
              <li key={logo.id} className="rounded-xl border border-hairline p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-2 ring-1 ring-hairline">
                    {logo.previewUrl ? (
                      // The API returns a sanitized, embedded SVG data URL.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo.previewUrl}
                        alt={`${logo.title}のプレビュー`}
                        className="max-h-full max-w-full"
                      />
                    ) : (
                      <span className="text-[10px] text-ink-faint">No preview</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{logo.title}</p>
                    <p className="mt-1 text-[10px] text-ink-muted">
                      {LOGO_ROLE_LABELS[logo.role as LogoRole] ?? logo.role} ・{" "}
                      {VISIBILITY_LABELS[
                        logo.visibility as LogoVisibility
                      ] ?? logo.visibility}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold">
                  <Link href={`/logos/${logo.id}`} className="text-accent hover:underline">
                    詳細・編集
                  </Link>
                  <Link href={`/p/${logo.id}`} className="text-accent hover:underline">
                    プレゼンを見る
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : !adding ? (
          <div className="rounded-xl bg-ink/[0.03] px-4 py-5 text-center">
            <p className="text-pretty text-xs text-ink-muted">
              このブランドにはロゴがまだありません。
            </p>
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setNotice(null);
              }}
              className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              最初のロゴを追加
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
