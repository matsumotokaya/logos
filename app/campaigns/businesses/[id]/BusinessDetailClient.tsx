"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  BrandUrlInspection,
  BusinessDetail,
  BusinessUpdate,
} from "@/lib/brand-detail";
import BrandUrlImportDialog from "../../BrandUrlImportDialog";
import { authedFetch } from "../../campaign-ui";
import BusinessMoveDialog from "./BusinessMoveDialog";
import BrandLogoAssets from "./BrandLogoAssets";
import { refreshBrandTree } from "@/lib/brand-events";

const EMPTY_FORM: BusinessUpdate = {
  name: "",
  website: "",
  industry: "",
  location: "",
  description: "",
  parentOrganizationId: "",
};

const EMPTY_SELECTION = { name: false, website: false, description: false };

function formFrom(detail: BusinessDetail): BusinessUpdate {
  return {
    name: detail.name,
    website: detail.website,
    industry: detail.industry,
    location: detail.location,
    description: detail.description,
    parentOrganizationId: detail.parentOrganization.id,
  };
}

function editableFields(value: BusinessUpdate) {
  return {
    name: value.name,
    website: value.website,
    industry: value.industry,
    location: value.location,
    description: value.description,
  };
}

function paletteFrom(profile: BusinessDetail["profile"]): string[] {
  const palette = profile?.value.palette;
  if (!palette || typeof palette !== "object") return [];
  return Object.values(palette as Record<string, unknown>)
    .filter(
      (value): value is string =>
        typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value),
    )
    .slice(0, 6);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function BusinessDetailClient({ id }: { id: string }) {
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [form, setForm] = useState<BusinessUpdate>(EMPTY_FORM);
  const [targetOrganizationId, setTargetOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [inspection, setInspection] = useState<BrandUrlInspection | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedImportFields, setSelectedImportFields] =
    useState(EMPTY_SELECTION);
  // The palette, design tokens and logo from the last inspection, waiting for
  // the save that applies them. They ride along with the text fields rather
  // than being written on inspect: nothing is stored until the user saves.
  const [pendingBrandAssets, setPendingBrandAssets] = useState<
    BrandUrlInspection["brandAssets"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authedFetch(`/api/brands/businesses/${id}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          business?: BusinessDetail;
          error?: string;
        } | null;
        if (!response.ok || !body?.business) {
          throw new Error(body?.error ?? "ブランドを読み込めませんでした");
        }
        if (cancelled) return;
        setDetail(body.business);
        setForm(formFrom(body.business));
        setTargetOrganizationId(body.business.parentOrganization.id);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "ブランドを読み込めませんでした",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setField = <Key extends keyof BusinessUpdate>(
    field: Key,
    value: BusinessUpdate[Key],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const patchBusiness = async (
    payload: BusinessUpdate,
    brandImport?: BrandUrlInspection["brandAssets"] | null,
  ) => {
    const response = await authedFetch(`/api/brands/businesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brandImport ? { ...payload, brandImport } : payload),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      parentChanged?: boolean;
      logo?: BusinessDetail["logos"][number] | null;
      error?: string;
    } | null;
    if (!response.ok || !body?.ok) {
      throw new Error(body?.error ?? "ブランドを保存できませんでした");
    }
    return body;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await patchBusiness(form, pendingBrandAssets);
      const savedLogo = result.logo ?? null;
      setDetail((current) =>
        current
          ? {
              ...current,
              ...editableFields(form),
              logos: savedLogo
                ? [
                    savedLogo,
                    ...current.logos.filter((logo) => logo.id !== savedLogo.id),
                  ]
                : current.logos,
              status: "confirmed",
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      setPendingBrandAssets(null);
      refreshBrandTree();
      setNotice(
        savedLogo
          ? "ブランド情報とロゴを保存しました。"
          : "ブランド情報を保存しました。",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存できませんでした",
      );
    } finally {
      setSaving(false);
    }
  };

  const inspectUrl = async () => {
    setInspecting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await authedFetch("/api/brands/inspect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.website, scope: "business" }),
      });
      const body = (await response.json().catch(() => null)) as {
        inspection?: BrandUrlInspection;
        error?: string;
      } | null;
      if (!response.ok || !body?.inspection) {
        throw new Error(body?.error ?? "URLから情報を取得できませんでした");
      }
      const next = body.inspection;
      setInspection(next);
      setSelectedImportFields({
        name: Boolean(
          next.name && (!form.name || form.name.includes("未設定")),
        ),
        website: Boolean(next.finalUrl && next.finalUrl !== form.website),
        description: Boolean(next.description && !form.description),
      });
      setImportOpen(true);
    } catch (inspectError) {
      setError(
        inspectError instanceof Error
          ? inspectError.message
          : "URLから情報を取得できませんでした",
      );
    } finally {
      setInspecting(false);
    }
  };

  const applyInspection = () => {
    if (!inspection) return;
    setForm((current) => ({
      ...current,
      name: selectedImportFields.name ? inspection.name : current.name,
      website: selectedImportFields.website
        ? inspection.finalUrl
        : current.website,
      description: selectedImportFields.description
        ? inspection.description
        : current.description,
    }));
    setPendingBrandAssets(inspection.brandAssets);
    setImportOpen(false);
    setNotice(
      inspection.brandAssets
        ? "取得した候補を入力欄へ反映しました。保存するとロゴ・カラー・フォントも取り込みます。"
        : "取得した候補を入力欄へ反映しました。内容を確認して保存してください。",
    );
  };

  const moveBusiness = async () => {
    if (!detail || targetOrganizationId === detail.parentOrganization.id)
      return;
    const target = detail.availableOrganizations.find(
      (organization) => organization.id === targetOrganizationId,
    );
    if (!target) return;
    setMoving(true);
    setError(null);
    setNotice(null);
    try {
      await patchBusiness({
        name: detail.name,
        website: detail.website,
        industry: detail.industry,
        location: detail.location,
        description: detail.description,
        parentOrganizationId: target.id,
      });
      setForm((current) => ({ ...current, parentOrganizationId: target.id }));
      setDetail((current) =>
        current
          ? {
              ...current,
              parentOrganization: { id: target.id, name: target.name },
              status: "confirmed",
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      setMoveOpen(false);
      refreshBrandTree();
      setNotice(`「${target.name}」にブランドを取り込みました。`);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "ブランドを取り込めませんでした",
      );
      setMoveOpen(false);
    } finally {
      setMoving(false);
    }
  };

  if (loading) {
    return (
      <main
        className="mx-auto max-w-6xl px-6 py-10 md:px-10"
        aria-label="ブランドを読み込み中"
      >
        <div className="h-5 w-40 rounded bg-ink/10" />
        <div className="mt-6 h-12 w-2/3 rounded bg-ink/10" />
        <div className="mt-8 h-80 rounded-2xl bg-ink/5" />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center md:px-10">
        <h1 className="text-balance font-display text-2xl font-semibold">
          ブランドを開けませんでした
        </h1>
        <p className="mt-3 text-pretty text-sm text-red-700">{error}</p>
        <Link
          href="/brands"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          ブランド一覧へ戻る
        </Link>
      </main>
    );
  }

  const colors = paletteFrom(detail.profile);
  const kindLabel =
    detail.kind === "corporate"
      ? "企業ブランド"
      : detail.kind === "audience"
        ? "対象別ブランド"
        : "事業ブランド";
  const targetOrganization = detail.availableOrganizations.find(
    (organization) => organization.id === targetOrganizationId,
  );
  const canMove = Boolean(
    targetOrganization &&
    targetOrganization.id !== detail.parentOrganization.id,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <Link
          href="/brands"
          className="underline underline-offset-4 hover:text-ink"
        >
          ブランド一覧
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/organizations/${detail.parentOrganization.id}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          {detail.parentOrganization.name}
        </Link>
      </div>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-balance font-display text-3xl font-semibold">
              {detail.name}
            </h1>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
              {detail.status === "confirmed" ? "確認済み" : "未確認"}
            </span>
            <span className="rounded-full border border-hairline px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
              {kindLabel}
            </span>
          </div>
          <p className="mt-2 text-pretty text-sm text-ink-muted">
            ブランド情報と、ロゴ・LP・動画などのアセットを管理します。
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 text-xs">
          <div>
            <dt className="text-ink-faint">ロゴ</dt>
            <dd className="mt-1 tabular-nums font-semibold">
              {detail.logos.length}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">LP</dt>
            <dd className="mt-1 tabular-nums font-semibold">
              {detail.campaigns.length}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">対象別</dt>
            <dd className="mt-1 tabular-nums font-semibold">
              {detail.audiences.length}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-hairline p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-balance text-lg font-semibold">ブランド情報</h2>
                <p className="mt-1 text-pretty text-xs text-ink-muted">
                  URLから候補を取得するか、直接編集できます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void inspectUrl()}
                disabled={!form.website.trim() || inspecting}
                className="rounded-full border border-ink px-4 py-2 text-xs font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-white"
              >
                {inspecting ? "取得しています…" : "URLから情報を取得"}
              </button>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">ブランド名</span>
                <input
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">業種</span>
                <input
                  value={form.industry}
                  onChange={(event) => setField("industry", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">所在地</span>
                <input
                  value={form.location}
                  onChange={(event) => setField("location", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">WebサイトURL</span>
                <input
                  type="url"
                  value={form.website}
                  onChange={(event) => setField("website", event.target.value)}
                  placeholder="https://example.com"
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">説明</span>
                <textarea
                  rows={6}
                  value={form.description}
                  onChange={(event) =>
                    setField("description", event.target.value)
                  }
                  className="mt-2 w-full resize-y rounded-lg border border-hairline px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
            </div>

            <div className="mt-5 min-h-5" aria-live="polite">
              {error ? (
                <p className="text-pretty text-xs text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="text-pretty text-xs text-emerald-700">{notice}</p>
              ) : null}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || moving || !form.name.trim()}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
              >
                {saving ? "保存しています…" : "変更を保存"}
              </button>
            </div>
          </section>

          <BrandLogoAssets
            brandId={id}
            brandName={detail.name}
            brandKind={detail.kind}
            logos={detail.logos}
            onLogoCreated={(logo) =>
              setDetail((current) =>
                current
                  ? { ...current, logos: [...current.logos, logo] }
                  : current,
              )
            }
          />

          {detail.kind === "business" ? (
          <section className="rounded-2xl border border-hairline p-5 md:p-6">
            <h2 className="text-balance text-lg font-semibold">
              Organizationへの取り込み
            </h2>
            <p className="mt-1 text-pretty text-xs text-ink-muted">
              現在の所属先は「{detail.parentOrganization.name}」です。
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">取り込み先Organization</span>
                <select
                  value={targetOrganizationId}
                  onChange={(event) =>
                    setTargetOrganizationId(event.target.value)
                  }
                  className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                >
                  {detail.availableOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setMoveOpen(true)}
                disabled={!canMove || saving || moving}
                className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-white"
              >
                このOrganizationに取り込む
              </button>
            </div>
            {detail.availableOrganizations.length <= 1 ? (
              <p className="mt-3 text-pretty text-xs text-ink-muted">
                取り込み先にできる別のOrganizationはまだありません。
              </p>
            ) : null}
          </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-hairline p-5">
            <h2 className="text-balance text-sm font-semibold">
              ブランドアセット
            </h2>
            {colors.length > 0 ? (
              <div
                className="mt-4 flex flex-wrap gap-2"
                aria-label="ブランドカラー"
              >
                {/* Index in the key: a palette legitimately repeats a colour
                    (e.g. background and surface both #ffffff), and the hex
                    alone made React warn about duplicate keys. */}
                {colors.map((color, i) => (
                  <span
                    key={`${color}-${i}`}
                    className="size-8 rounded-full border border-hairline"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-pretty text-xs text-ink-muted">
                ブランドカラーはまだ登録されていません。
              </p>
            )}
            <p className="mt-4 text-xs text-ink-muted">
              {detail.profile?.inheritsParent
                ? "親ブランドのルールを継承"
                : "このブランド固有のルールを使用"}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              ロゴ{" "}
              <span className="tabular-nums font-semibold text-ink">
                {detail.logos.length}
              </span>
              件
            </p>
          </section>

          <section className="rounded-2xl border border-hairline p-5">
            <h2 className="text-balance text-sm font-semibold">LP</h2>
            {detail.campaigns.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {detail.campaigns.slice(0, 5).map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      href={`/brands/${id}/lp/${campaign.id}`}
                      className="block rounded-lg bg-ink/[0.03] px-3 py-2.5 hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <p className="truncate text-xs font-semibold">
                        {campaign.name}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {formatDate(campaign.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-pretty text-xs text-ink-muted">
                まだありません。
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-hairline p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-balance text-sm font-semibold">動画</h2>
              <Link
                href={`/brands/${id}/video`}
                className="text-[11px] text-accent hover:underline"
              >
                管理する →
              </Link>
            </div>
            <p className="mt-3 text-pretty text-xs text-ink-muted">
              製品紹介動画は既定で用意されています。イベント動画などは「管理する」から追加できます。
            </p>
          </section>

          {detail.audiences.length > 0 ? (
            <section className="rounded-2xl border border-hairline p-5">
              <h2 className="text-balance text-sm font-semibold">
                対象別ブランド
              </h2>
              <ul className="mt-3 space-y-2 text-xs">
                {detail.audiences.map((audience) => (
                  <li
                    key={audience.id}
                    className="rounded-lg bg-ink/[0.03] px-3 py-2.5"
                  >
                    {audience.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <BrandUrlImportDialog
        open={importOpen}
        nameLabel="ブランド名"
        inspection={inspection}
        current={{
          name: form.name,
          website: form.website,
          description: form.description,
        }}
        selected={selectedImportFields}
        onSelectedChange={(field, selected) =>
          setSelectedImportFields((current) => ({
            ...current,
            [field]: selected,
          }))
        }
        onCancel={() => setImportOpen(false)}
        onApply={applyInspection}
      />

      {detail.kind === "business" ? (
      <BusinessMoveDialog
        open={moveOpen}
        businessName={detail.name}
        currentOrganizationName={detail.parentOrganization.name}
        targetOrganizationName={targetOrganization?.name ?? ""}
        logoCount={detail.logos.length}
        campaignCount={detail.campaigns.length}
        audienceCount={detail.audiences.length}
        moving={moving}
        onCancel={() => setMoveOpen(false)}
        onConfirm={() => void moveBusiness()}
      />
      ) : null}
    </main>
  );
}
