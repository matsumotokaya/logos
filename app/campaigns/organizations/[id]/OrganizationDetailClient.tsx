"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  BrandUrlInspection,
  OrganizationDetail,
  OrganizationKind,
  OrganizationUpdate,
} from "@/lib/brand-detail";
import { labsRequest } from "@/lib/labs-client";
import { ProcessLogPopup, type StepEvent } from "../../ProcessLogPopup";
import BrandUrlImportDialog from "../../BrandUrlImportDialog";
import BrandSourceInputDialog from "../../BrandSourceInputDialog";
import OrganizationBusinessImportDialog from "./OrganizationBusinessImportDialog";
import OrganizationDeleteDialog from "./OrganizationDeleteDialog";
import { refreshBrandTree } from "@/lib/brand-events";

const EMPTY_FORM: OrganizationUpdate = {
  name: "",
  organizationKind: "other",
  website: "",
  industry: "",
  location: "",
  description: "",
};

const ORGANIZATION_IMPORT_FIELDS = [
  "name",
  "organizationKind",
  "industry",
  "location",
  "website",
  "description",
] as const;

const EMPTY_SELECTION = {
  name: false,
  organizationKind: false,
  industry: false,
  location: false,
  website: false,
  description: false,
};

const stepTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", { hour12: false });

function formFrom(detail: OrganizationDetail): OrganizationUpdate {
  return {
    name: detail.name,
    organizationKind: detail.organizationKind ?? "other",
    website: detail.website,
    industry: detail.industry,
    location: detail.location,
    description: detail.description,
  };
}

function paletteEntriesFrom(
  profile: OrganizationDetail["profile"],
): Array<[string, string]> {
  const palette = profile?.value.palette;
  if (!palette || typeof palette !== "object") return [];
  return Object.entries(palette as Record<string, unknown>)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && /^#[0-9a-f]{6}$/i.test(entry[1]),
    )
    .slice(0, 6);
}

function designTokensFrom(
  profile: OrganizationDetail["profile"],
): Record<string, string> {
  const tokens = profile?.value.design_tokens;
  if (!tokens || typeof tokens !== "object") return {};
  return Object.fromEntries(
    Object.entries(tokens as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

const DESIGN_TOKEN_LABELS: Record<string, string> = {
  heading_font: "見出しフォント",
  body_font: "本文フォント",
  button_radius: "ボタンの角丸",
  button_padding: "ボタン余白",
  section_spacing: "セクション余白",
  container_width: "コンテンツ幅",
};

const PALETTE_ROLE_LABELS: Record<string, string> = {
  primary: "メイン",
  accent: "アクセント",
  background: "背景",
  surface: "サーフェス",
  text: "テキスト",
};

const LOGO_ROLE_LABELS: Record<string, string> = {
  corporate: "コーポレートロゴ",
  service: "サービスロゴ",
  product: "プロダクトロゴ",
  campaign: "キャンペーンロゴ",
};

export default function OrganizationDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [form, setForm] = useState<OrganizationUpdate>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [applyingImport, setApplyingImport] = useState(false);
  const [inspection, setInspection] = useState<BrandUrlInspection | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSteps, setSourceSteps] = useState<StepEvent[]>([]);
  const [selectedImportFields, setSelectedImportFields] =
    useState(EMPTY_SELECTION);
  const [selectedBrandAssets, setSelectedBrandAssets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [businessImportOpen, setBusinessImportOpen] = useState(false);
  const [importingBusiness, setImportingBusiness] = useState(false);
  const [businessImportError, setBusinessImportError] = useState<string | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void labsRequest(`/api/brands/${id}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          organization?: OrganizationDetail;
          error?: string;
        } | null;
        if (!response.ok || !body?.organization) {
          throw new Error(body?.error ?? "Organizationを読み込めませんでした");
        }
        if (cancelled) return;
        setDetail(body.organization);
        setForm(formFrom(body.organization));
        setSelectedBusinessId(
          body.organization.availableBusinesses[0]?.id ?? "",
        );
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Organizationを読み込めませんでした",
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

  const setField = <Key extends keyof OrganizationUpdate>(
    field: Key,
    value: OrganizationUpdate[Key],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await labsRequest(`/api/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error ?? "Organizationを保存できませんでした");
      }
      setDetail((current) =>
        current
          ? {
              ...current,
              ...form,
              status: "confirmed",
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      refreshBrandTree();
      setNotice("Organization情報を保存しました。");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存できませんでした",
      );
    } finally {
      setSaving(false);
    }
  };

  const openSourcePanel = () => {
    setSourceUrl(form.website);
    setSourceError(null);
    setSourceOpen(true);
  };

  const saveWebsite = async () => {
    setSavingSource(true);
    setSourceError(null);
    setNotice(null);
    try {
      const response = await labsRequest(`/api/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateMode: "website_only",
          website: sourceUrl,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        website?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok || !body.website) {
        throw new Error(body?.error ?? "WebサイトURLを保存できませんでした");
      }
      setForm((current) => ({
        ...current,
        website: body.website ?? current.website,
      }));
      setDetail((current) =>
        current
          ? {
              ...current,
              website: body.website ?? current.website,
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      setSourceUrl(body.website);
      setSourceOpen(false);
      setNotice("公式WebサイトURLを情報源として保存しました。");
    } catch (saveError) {
      setSourceError(
        saveError instanceof Error
          ? saveError.message
          : "WebサイトURLを保存できませんでした",
      );
    } finally {
      setSavingSource(false);
    }
  };

  const inspectUrl = async () => {
    setInspecting(true);
    setSourceError(null);
    setImportError(null);
    setNotice(null);
    const startedAt = new Date().toISOString();
    setSourceSteps([
      {
        id: 0,
        ts: stepTime(startedAt),
        message: "公式Webサイトへ接続しています",
        level: "info",
      },
      {
        id: 1,
        ts: stepTime(startedAt),
        message: "種別・業種・所在地などの基本情報を解析しています",
        level: "info",
      },
      {
        id: 2,
        ts: stepTime(startedAt),
        message: "実画面からカラー・フォント・ロゴ候補を取得しています",
        level: "info",
      },
    ]);
    try {
      const response = await labsRequest("/api/brands/inspect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, scope: "organization" }),
      });
      const body = (await response.json().catch(() => null)) as {
        inspection?: BrandUrlInspection;
        error?: string;
      } | null;
      if (!response.ok || !body?.inspection) {
        throw new Error(body?.error ?? "URLから情報を取得できませんでした");
      }
      const next = body.inspection;
      setSourceSteps((current) => [
        ...current,
        {
          id: current.length,
          ts: stepTime(new Date().toISOString()),
          message: "Organization情報の候補を取得しました",
          level: "success",
        },
      ]);
      setInspection(next);
      setSelectedImportFields({
        name: Boolean(next.name && next.name !== form.name),
        organizationKind: Boolean(
          next.organizationKind &&
          next.organizationKind !== form.organizationKind,
        ),
        industry: Boolean(next.industry && next.industry !== form.industry),
        location: Boolean(next.location && next.location !== form.location),
        website: Boolean(next.finalUrl && next.finalUrl !== form.website),
        description: Boolean(
          next.description && next.description !== form.description,
        ),
      });
      setSelectedBrandAssets(Boolean(next.brandAssets));
      setSourceOpen(false);
      setImportOpen(true);
    } catch (inspectError) {
      const message =
        inspectError instanceof Error
          ? inspectError.message
          : "URLから情報を取得できませんでした";
      setSourceError(message);
      setSourceSteps((current) => [
        ...current,
        {
          id: current.length,
          ts: stepTime(new Date().toISOString()),
          message,
          level: "warn",
        },
      ]);
    } finally {
      setInspecting(false);
    }
  };

  const applyInspection = async () => {
    if (!inspection || !detail) return;
    const importedFields = (
      Object.keys(selectedImportFields) as Array<
        keyof typeof selectedImportFields
      >
    ).filter((field) => selectedImportFields[field]);
    const nextForm: OrganizationUpdate = {
      ...formFrom(detail),
      name: selectedImportFields.name ? inspection.name : detail.name,
      organizationKind: selectedImportFields.organizationKind
        ? inspection.organizationKind
        : (detail.organizationKind ?? "other"),
      industry: selectedImportFields.industry
        ? inspection.industry
        : detail.industry,
      location: selectedImportFields.location
        ? inspection.location
        : detail.location,
      website: selectedImportFields.website
        ? inspection.finalUrl
        : detail.website,
      description: selectedImportFields.description
        ? inspection.description
        : detail.description,
    };
    setApplyingImport(true);
    setImportError(null);
    setNotice(null);
    try {
      const response = await labsRequest(`/api/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextForm,
          updateMode: "all",
          updateSource: "website_import",
          sourceUrl: inspection.finalUrl,
          importedFields,
          brandImport: selectedBrandAssets ? inspection.brandAssets : null,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        profile?: OrganizationDetail["profile"];
        logo?: OrganizationDetail["logos"][number] | null;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error ?? "取得した情報で上書きできませんでした");
      }
      setForm(nextForm);
      setDetail((current) =>
        current
          ? {
              ...current,
              ...nextForm,
              status: "confirmed",
              updatedAt: new Date().toISOString(),
              profile: body.profile ?? current.profile,
              logos: body.logo ? [...current.logos, body.logo] : current.logos,
            }
          : current,
      );
      setSourceUrl(nextForm.website);
      setImportOpen(false);
      refreshBrandTree();
      setNotice("公式Webサイトから取得した情報でOrganizationを更新しました。");
    } catch (applyError) {
      setImportError(
        applyError instanceof Error
          ? applyError.message
          : "取得した情報で上書きできませんでした",
      );
    } finally {
      setApplyingImport(false);
    }
  };

  const importBusiness = async () => {
    if (!selectedBusinessId) return;
    setImportingBusiness(true);
    setBusinessImportError(null);
    setNotice(null);
    try {
      const response = await labsRequest(`/api/brands/${id}/businesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selectedBusinessId }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        business?: OrganizationDetail["businesses"][number];
        error?: string;
      } | null;
      if (!response.ok || !body?.ok || !body.business) {
        throw new Error(body?.error ?? "ブランドを取り込めませんでした");
      }

      const importedBusiness = body.business;
      const remainingBusinesses =
        detail?.availableBusinesses.filter(
          (business) => business.id !== importedBusiness.id,
        ) ?? [];
      setDetail((current) =>
        current
          ? {
              ...current,
              businesses: [...current.businesses, importedBusiness],
              availableBusinesses: current.availableBusinesses.filter(
                (business) => business.id !== importedBusiness.id,
              ),
              updatedAt: new Date().toISOString(),
            }
          : current,
      );
      setSelectedBusinessId(remainingBusinesses[0]?.id ?? "");
      setBusinessImportOpen(false);
      refreshBrandTree();
      setNotice(
        `「${importedBusiness.name}」をこのOrganizationに取り込みました。`,
      );
    } catch (importError) {
      setBusinessImportError(
        importError instanceof Error
          ? importError.message
          : "ブランドを取り込めませんでした",
      );
    } finally {
      setImportingBusiness(false);
    }
  };

  const deleteOrganization = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await labsRequest(`/api/brands/${id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error ?? "Organizationを削除できませんでした");
      }
      refreshBrandTree();
      router.replace("/brands");
      router.refresh();
    } catch (deleteOrganizationError) {
      setDeleteError(
        deleteOrganizationError instanceof Error
          ? deleteOrganizationError.message
          : "Organizationを削除できませんでした",
      );
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main
        className="mx-auto max-w-6xl px-6 py-10 md:px-10"
        aria-label="Organizationを読み込み中"
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
          Organizationを開けませんでした
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

  const paletteEntries = paletteEntriesFrom(detail.profile);
  const designTokens = designTokensFrom(detail.profile);
  const selectedBusiness = detail.availableBusinesses.find(
    (business) => business.id === selectedBusinessId,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <Link
        href="/brands"
        className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        ← ブランド一覧
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-balance font-display text-3xl font-semibold">
              {detail.name}
            </h1>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
              {detail.status === "confirmed" ? "確認済み" : "未確認"}
            </span>
          </div>
          <p className="mt-2 text-pretty text-sm text-ink-muted">
            Organization情報と、その配下のブランドを管理します。
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 text-xs">
          <div>
            <dt className="text-ink-faint">事業ブランド</dt>
            <dd className="mt-1 tabular-nums font-semibold">
              {detail.businesses.length}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">直下のロゴ</dt>
            <dd className="mt-1 tabular-nums font-semibold">
              {detail.logos.length}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-hairline p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-balance text-lg font-semibold">
                  Organization情報
                </h2>
                <p className="mt-1 text-pretty text-xs text-ink-muted">
                  公式Webサイトを情報源として登録し、確認後に最新情報で更新できます。
                </p>
              </div>
              <button
                type="button"
                onClick={openSourcePanel}
                className="rounded-full border border-ink px-4 py-2 text-xs font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-white"
              >
                ＋ オーガニゼーション情報を追加する
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-hairline bg-ink/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted">
                    情報源・公式Webサイト
                  </p>
                  {form.website ? (
                    <a
                      href={form.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm font-semibold text-ink underline underline-offset-4 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {form.website}
                    </a>
                  ) : (
                    <p className="mt-1 text-pretty text-sm text-ink-muted">
                      URLはまだ登録されていません。
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openSourcePanel}
                  className="shrink-0 rounded-full border border-hairline bg-white px-4 py-2 text-xs font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {form.website ? "URL・情報を更新" : "URLを登録"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">Organization名</span>
                <input
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">種別</span>
                <select
                  value={form.organizationKind ?? "other"}
                  onChange={(event) =>
                    setField(
                      "organizationKind",
                      event.target.value as OrganizationKind,
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                >
                  <option value="company">会社</option>
                  <option value="individual">個人・個人事業</option>
                  <option value="nonprofit">非営利組織</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold">業種</span>
                <input
                  value={form.industry}
                  onChange={(event) => setField("industry", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-hairline px-3 py-2.5 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">所在地</span>
                <input
                  value={form.location}
                  onChange={(event) => setField("location", event.target.value)}
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

            <div className="mt-5 min-h-5">
              {error ? (
                <p className="text-pretty text-xs text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p
                  className="text-pretty text-xs text-emerald-700"
                  role="status"
                >
                  {notice}
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !form.name.trim()}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-ink/25"
              >
                {saving ? "保存しています…" : "変更を保存"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-hairline p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-balance text-lg font-semibold">
                  ブランドプロフィール
                </h2>
                <p className="mt-1 text-pretty text-xs text-ink-muted">
                  このOrganizationの企業ブランドが持つデザインルールとロゴです。
                </p>
              </div>
              <span className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
                {detail.profile?.status === "confirmed" ? "確認済み" : "未確認"}
              </span>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-ink">カラー</h3>
                {paletteEntries.length > 0 ? (
                  <div
                    className="mt-3 flex flex-wrap gap-3"
                    aria-label="Organizationのブランドカラー"
                  >
                    {paletteEntries.map(([role, color]) => (
                      <span
                        key={`${role}-${color}`}
                        className="text-center text-[10px] text-ink-muted"
                      >
                        <span
                          aria-hidden
                          className="mx-auto block size-10 rounded-full border border-hairline"
                          style={{ backgroundColor: color }}
                        />
                        <span className="mt-1 block font-semibold text-ink">
                          {PALETTE_ROLE_LABELS[role] ?? role}
                        </span>
                        <span className="block tabular-nums">{color}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-pretty text-xs text-ink-muted">
                    ブランドカラーはまだ登録されていません。
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-ink">
                  タイポグラフィ・デザインルール
                </h3>
                {Object.keys(designTokens).length > 0 ? (
                  <dl className="mt-3 space-y-2 text-xs">
                    {Object.entries(designTokens).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3"
                      >
                        <dt className="text-ink-muted">
                          {DESIGN_TOKEN_LABELS[key] ?? key}
                        </dt>
                        <dd className="max-w-[60%] text-right font-semibold text-ink">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-pretty text-xs text-ink-muted">
                    フォントや余白のルールはまだ登録されていません。
                  </p>
                )}
              </section>
            </div>

            <section className="mt-6 border-t border-hairline pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">ロゴアセット</h3>
                <span className="tabular-nums text-xs text-ink-muted">
                  {detail.logos.length}件
                </span>
              </div>
              {detail.logos.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {detail.logos.map((logo) => (
                    <li key={logo.id}>
                      <Link
                        href={`/logos/${logo.id}`}
                        className="block rounded-xl bg-ink/[0.03] p-3 hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <span className="flex aspect-[3/1] items-center justify-center rounded-lg bg-white p-3">
                          {logo.previewUrl ? (
                            <Image
                              src={logo.previewUrl}
                              alt={`${logo.title}のロゴ`}
                              width={320}
                              height={120}
                              unoptimized
                              className="max-h-full w-auto max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-ink-faint">
                              プレビューなし
                            </span>
                          )}
                        </span>
                        <span className="mt-3 block truncate text-sm font-semibold text-ink">
                          {logo.title}
                        </span>
                        <span className="mt-1 block text-[10px] text-ink-muted">
                          {LOGO_ROLE_LABELS[logo.role] ?? logo.role}・
                          {logo.visibility}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-pretty text-xs text-ink-muted">
                  ロゴはまだ登録されていません。公式サイトから取得すると候補を追加できます。
                </p>
              )}
            </section>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-hairline p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-balance text-sm font-semibold">
                事業ブランド
              </h2>
              <span className="tabular-nums text-xs text-ink-muted">
                {detail.businesses.length}件
              </span>
            </div>
            {detail.businesses.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {detail.businesses.map((business) => (
                  <li key={business.id}>
                    <Link
                      href={`/brands/${business.id}`}
                      className="block rounded-lg bg-ink/[0.03] px-3 py-2.5 hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      <p className="truncate text-sm font-semibold">
                        {business.name}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-ink-muted">
                        {business.website || "URL未登録"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-pretty text-xs text-ink-muted">
                事業ブランドはまだありません。
              </p>
            )}

            <div className="mt-5 border-t border-hairline pt-5">
              {detail.availableBusinesses.length > 0 ? (
                <>
                  <label
                    htmlFor="organization-business-import"
                    className="text-xs font-semibold text-ink"
                  >
                    登録済みの事業ブランドを取り込む
                  </label>
                  <select
                    id="organization-business-import"
                    value={selectedBusinessId}
                    onChange={(event) => {
                      setSelectedBusinessId(event.target.value);
                      setBusinessImportError(null);
                    }}
                    className="mt-2 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-xs outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                  >
                    {detail.availableBusinesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}（{business.parentOrganization.name}）
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setBusinessImportError(null);
                      setBusinessImportOpen(true);
                    }}
                    disabled={!selectedBusiness}
                    className="mt-3 w-full rounded-full border border-ink px-4 py-2.5 text-xs font-semibold text-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-faint disabled:hover:bg-white"
                  >
                    このブランドを取り込む
                  </button>
                </>
              ) : (
                <p className="text-pretty text-xs text-ink-muted">
                  取り込み可能な別の事業ブランドはありません。
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-12 border-t border-red-200 pt-8">
        <h2 className="text-balance text-sm font-semibold text-ink">
          Organizationの削除
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-xs text-ink-muted">
          配下の事業ブランドをすべて別のOrganizationへ移動した後に削除できます。空の企業ブランドも同時に削除されます。
        </p>
        {detail.businesses.length > 0 ? (
          <p className="mt-3 text-pretty text-xs text-red-700" role="status">
            現在{detail.businesses.length}
            件の事業ブランドがあるため、先に移動してください。
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
          disabled={detail.businesses.length > 0 || deleting}
          className="mt-4 rounded-full border border-red-700 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:border-red-200 disabled:text-red-300 disabled:hover:bg-white"
        >
          このOrganizationを削除
        </button>
      </section>

      <BrandSourceInputDialog
        open={sourceOpen}
        title="オーガニゼーション情報を追加する"
        description="公式WebサイトのURLを登録するか、サイトから最新のOrganization情報を取得します。"
        subjectLabel="オーガニゼーション情報"
        url={sourceUrl}
        savedUrl={form.website}
        saving={savingSource}
        inspecting={inspecting}
        error={sourceError}
        onUrlChange={(nextUrl) => {
          setSourceUrl(nextUrl);
          setSourceError(null);
        }}
        onSaveUrl={() => void saveWebsite()}
        onInspect={() => void inspectUrl()}
        onCancel={() => {
          setSourceOpen(false);
          setSourceError(null);
        }}
      />

      <BrandUrlImportDialog
        open={importOpen}
        nameLabel="Organization名"
        inspection={inspection}
        fields={[...ORGANIZATION_IMPORT_FIELDS]}
        current={{
          name: form.name,
          organizationKind: form.organizationKind ?? "other",
          industry: form.industry,
          location: form.location,
          website: form.website,
          description: form.description,
        }}
        selected={selectedImportFields}
        selectedBrandAssets={selectedBrandAssets}
        applying={applyingImport}
        description="取得した情報を確認してください。チェックした項目は、確認後すぐOrganization情報へ上書き保存されます。"
        applyLabel="この情報で上書きする"
        error={importError}
        onSelectedChange={(field, selected) =>
          setSelectedImportFields((current) => ({
            ...current,
            [field]: selected,
          }))
        }
        onSelectedBrandAssetsChange={setSelectedBrandAssets}
        onCancel={() => {
          setImportOpen(false);
          setImportError(null);
        }}
        onApply={() => void applyInspection()}
      />

      <OrganizationBusinessImportDialog
        open={businessImportOpen}
        businessName={selectedBusiness?.name ?? ""}
        currentOrganizationName={
          selectedBusiness?.parentOrganization.name ?? ""
        }
        targetOrganizationName={detail.name}
        importing={importingBusiness}
        error={businessImportError}
        onCancel={() => {
          setBusinessImportOpen(false);
          setBusinessImportError(null);
        }}
        onConfirm={() => void importBusiness()}
      />

      <OrganizationDeleteDialog
        open={deleteOpen}
        organizationName={detail.name}
        logoCount={detail.logos.length}
        deleting={deleting}
        error={deleteError}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void deleteOrganization()}
      />

      {inspecting ? (
        <ProcessLogPopup
          steps={sourceSteps}
          title="Webサイトから情報を取得中"
          hint="取得後に内容を確認できます"
        />
      ) : null}
    </main>
  );
}
