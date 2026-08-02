"use client";

import { Menu } from "@base-ui/react/menu";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  BrandBusinessSummary,
  BrandCampaignSummary,
  BrandOrganizationSummary,
} from "@/lib/brand-hierarchy";
import { cn } from "@/lib/cn";
import { authedFetch } from "../campaign-ui";

const ROLE_LABELS: Record<string, string> = {
  corporate: "コーポレートロゴ",
  service: "サービスロゴ",
  product: "プロダクトロゴ",
  campaign: "キャンペーンロゴ",
};

const VIDEO_LABELS: Record<BrandCampaignSummary["videoStatus"], string> = {
  not_created: "動画未生成",
  preview_ready: "動画プレビューあり",
  mp4_ready: "MP4生成済み",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("size-4 shrink-0", open && "rotate-90")}
    >
      <path
        d="m7.5 5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="size-4"
    >
      <circle cx="4" cy="10" r="1.25" />
      <circle cx="10" cy="10" r="1.25" />
      <circle cx="16" cy="10" r="1.25" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="size-3.5"
    >
      <path
        d="M8 5h7v7M15 5l-9.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function businessesOf(
  organization: BrandOrganizationSummary,
): BrandBusinessSummary[] {
  return organization.businesses.filter(
    (business) => business.kind === "business",
  );
}

function BusinessManagerSkeleton() {
  return (
    <main
      className="grid min-h-[calc(100dvh-8rem)] lg:grid-cols-[18rem_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="事業一覧を読み込み中"
    >
      <aside className="border-b border-hairline p-5 lg:border-r lg:border-b-0">
        <div className="h-5 w-28 rounded bg-ink/10" />
        <div className="mt-6 space-y-3">
          <div className="h-10 rounded-lg bg-ink/5" />
          <div className="ml-5 h-9 rounded-lg bg-ink/5" />
          <div className="ml-5 h-9 rounded-lg bg-ink/5" />
        </div>
      </aside>
      <div className="p-6 md:p-10">
        <div className="h-4 w-48 rounded bg-ink/10" />
        <div className="mt-6 h-10 w-2/3 rounded bg-ink/10" />
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-80 rounded-2xl bg-ink/5" />
          <div className="h-80 rounded-2xl bg-ink/5" />
        </div>
      </div>
    </main>
  );
}

export default function BusinessManagerClient() {
  const [organizations, setOrganizations] = useState<
    BrandOrganizationSummary[] | null
  >(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    null,
  );
  const [expandedOrganizationIds, setExpandedOrganizationIds] = useState<
    Set<string>
  >(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await authedFetch("/api/brands");
      const body = (await response.json().catch(() => null)) as {
        organizations?: BrandOrganizationSummary[];
        error?: string;
      } | null;
      if (!response.ok || !body?.organizations) {
        throw new Error(body?.error ?? "事業一覧を取得できませんでした");
      }
      const nextOrganizations = body.organizations;
      const queryBusinessId = new URLSearchParams(window.location.search).get(
        "business",
      );
      const businessIds = new Set(
        nextOrganizations.flatMap((organization) =>
          businessesOf(organization).map((business) => business.id),
        ),
      );
      const firstBusinessId =
        nextOrganizations.flatMap((organization) =>
          businessesOf(organization),
        )[0]?.id ?? null;

      setOrganizations(nextOrganizations);
      setExpandedOrganizationIds(
        new Set(nextOrganizations.map((organization) => organization.id)),
      );
      setSelectedBusinessId((current) =>
        queryBusinessId && businessIds.has(queryBusinessId)
          ? queryBusinessId
          : current && businessIds.has(current)
            ? current
            : firstBusinessId,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "事業一覧を取得できませんでした",
      );
      setOrganizations([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const selected = (() => {
    for (const organization of organizations ?? []) {
      const business = businessesOf(organization).find(
        (candidate) => candidate.id === selectedBusinessId,
      );
      if (business) return { organization, business };
    }
    return null;
  })();

  const selectBusiness = (businessId: string) => {
    setSelectedBusinessId(businessId);
    const url = new URL(window.location.href);
    url.searchParams.set("business", businessId);
    window.history.replaceState(null, "", url);
  };

  const toggleOrganization = (organizationId: string) => {
    setExpandedOrganizationIds((current) => {
      const next = new Set(current);
      if (next.has(organizationId)) next.delete(organizationId);
      else next.add(organizationId);
      return next;
    });
  };

  if (organizations === null) return <BusinessManagerSkeleton />;

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center md:px-10">
        <h1 className="text-balance font-display text-2xl font-semibold">
          事業一覧を開けませんでした
        </h1>
        <p className="mt-3 text-pretty text-sm text-red-700" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          もう一度読み込む
        </button>
      </main>
    );
  }

  if (organizations.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-center md:px-10">
        <h1 className="text-balance font-display text-2xl font-semibold">
          まだ事業がありません
        </h1>
        <p className="mt-3 text-pretty text-sm text-ink-muted">
          URLや資料から最初のOrganizationと事業を登録してください。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          最初の事業を登録
        </Link>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100dvh-8rem)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside
        className="border-b border-hairline bg-ink/[0.02] lg:border-r lg:border-b-0"
        aria-label="Organizationと事業"
      >
        <div className="p-5 lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="mt-1 text-balance font-display text-lg font-semibold">
                事業管理
              </h1>
            </div>
            <span className="tabular-nums text-xs text-ink-faint">
              {organizations.reduce(
                (total, organization) =>
                  total + businessesOf(organization).length,
                0,
              )}
              件
            </span>
          </div>

          <nav className="mt-5" aria-label="事業を選択">
            <ul className="space-y-3">
              {organizations.map((organization) => {
                const organizationBusinesses = businessesOf(organization);
                const open = expandedOrganizationIds.has(organization.id);
                const regionId = `organization-businesses-${organization.id}`;
                return (
                  <li key={organization.id}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleOrganization(organization.id)}
                        aria-expanded={open}
                        aria-controls={regionId}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        <ChevronIcon open={open} />
                        <span className="truncate">{organization.name}</span>
                      </button>

                      <Menu.Root>
                        <Menu.Trigger
                          aria-label={`${organization.name}のメニュー`}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          <MoreIcon />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Positioner
                            side="bottom"
                            align="end"
                            sideOffset={6}
                            className="z-50 outline-none"
                          >
                            <Menu.Popup className="w-52 rounded-xl border border-hairline bg-paper p-1.5 shadow-lg outline-none">
                              <Menu.LinkItem
                                href={`/organizations/${organization.id}`}
                                closeOnClick
                                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-ink/5"
                              >
                                Organization詳細を開く
                              </Menu.LinkItem>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>
                    </div>

                    <ul
                      id={regionId}
                      hidden={!open}
                      className="mt-1 space-y-1 pl-6"
                    >
                      {organizationBusinesses.map((business) => {
                        const active = business.id === selectedBusinessId;
                        return (
                          <li key={business.id}>
                            <button
                              type="button"
                              onClick={() => selectBusiness(business.id)}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                                active
                                  ? "bg-ink text-white"
                                  : "text-ink-muted hover:bg-ink/5 hover:text-ink",
                              )}
                            >
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-current opacity-60"
                                aria-hidden="true"
                              />
                              <span className="truncate">{business.name}</span>
                            </button>
                          </li>
                        );
                      })}
                      {organizationBusinesses.length === 0 ? (
                        <li className="px-3 py-2 text-pretty text-xs text-ink-faint">
                          事業はまだありません
                        </li>
                      ) : null}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {selected ? (
        <BusinessPane
          organization={selected.organization}
          business={selected.business}
        />
      ) : (
        <section className="flex min-h-96 items-center justify-center p-8 text-center">
          <div>
            <h2 className="text-balance text-xl font-semibold">
              事業を選択してください
            </h2>
            <p className="mt-2 text-pretty text-sm text-ink-muted">
              左のOrganizationから管理する事業を選びます。
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

function BusinessPane({
  organization,
  business,
}: {
  organization: BrandOrganizationSummary;
  business: BrandBusinessSummary;
}) {
  const colors = [business.primary, business.accent].filter(
    (color): color is string => Boolean(color),
  );

  return (
    <section
      className="min-w-0 px-6 py-8 md:px-10 md:py-10"
      aria-labelledby="business-title"
    >
      <div className="mx-auto max-w-6xl">
        <nav
          className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          aria-label="現在の事業階層"
        >
          <Link
            href={`/organizations/${organization.id}`}
            className="hover:text-ink"
          >
            {organization.name}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-ink">{business.name}</span>
        </nav>

        <header className="mt-5 flex flex-wrap items-start justify-between gap-5 border-b border-hairline pb-7">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="business-title"
                className="text-balance font-display text-3xl font-semibold md:text-4xl"
              >
                {business.name}
              </h2>
              <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-muted">
                {business.status === "confirmed" ? "確認済み" : "未確認"}
              </span>
            </div>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-ink-muted">
              {business.description ||
                "この事業の概要はまだ登録されていません。事業詳細から情報を追加できます。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/businesses/${business.id}`}
              className="rounded-full border border-ink px-4 py-2 text-xs font-semibold hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              事業情報を編集
            </Link>
            <Link
              href={`/?business=${business.id}`}
              className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              キャンペーンを作る
            </Link>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-7">
            <section className="rounded-2xl border border-hairline p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-ink-muted">
                    OVERVIEW
                  </p>
                  <h3 className="mt-1 text-balance text-lg font-semibold">
                    事業概要
                  </h3>
                </div>
                <Link
                  href={`/businesses/${business.id}`}
                  className="text-xs font-semibold underline underline-offset-4 hover:text-ink-muted"
                >
                  詳細を見る
                </Link>
              </div>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-faint">Organization</dt>
                  <dd className="mt-1 text-pretty text-sm font-semibold">
                    {organization.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">業種</dt>
                  <dd className="mt-1 text-pretty text-sm font-semibold">
                    {business.industry || "未設定"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-faint">Webサイト</dt>
                  <dd className="mt-1 min-w-0 text-sm">
                    {business.website ? (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 font-semibold underline underline-offset-4 hover:text-ink-muted"
                      >
                        <span className="truncate">{business.website}</span>
                        <ExternalIcon />
                      </a>
                    ) : (
                      "未設定"
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-hairline p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-ink-muted">
                    BRAND ASSETS
                  </p>
                  <h3 className="mt-1 text-balance text-lg font-semibold">
                    ブランドアイデンティティ
                  </h3>
                  <p className="mt-1 text-pretty text-xs text-ink-muted">
                    事業固有の情報とOrganizationから継承したアセットをまとめて表示します。
                  </p>
                </div>
                <Link
                  href={`/businesses/${business.id}`}
                  className="text-xs font-semibold underline underline-offset-4 hover:text-ink-muted"
                >
                  ブランド情報を編集
                </Link>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
                <div>
                  <p className="text-xs text-ink-faint">カラーパレット</p>
                  {colors.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {colors.map((color) => (
                        <div key={color}>
                          <span
                            className="block size-10 rounded-full border border-hairline"
                            style={{ backgroundColor: color }}
                            aria-label={`ブランドカラー ${color}`}
                          />
                          <span className="mt-1 block font-mono text-[10px] text-ink-muted">
                            {color}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-pretty text-xs text-ink-muted">
                      カラーは未設定です。
                    </p>
                  )}
                  <p className="mt-5 text-xs text-ink-faint">フォント方針</p>
                  <p className="mt-1 text-sm font-semibold">
                    {business.fontStyle || "未設定"}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-faint">ロゴアセット</p>
                    <span className="tabular-nums text-xs text-ink-muted">
                      {business.logos.length}件
                    </span>
                  </div>
                  {business.logos.length > 0 ? (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {business.logos.map((logo) => (
                        <li key={logo.id}>
                          <Link
                            href={`/logos/${logo.id}`}
                            className="block rounded-xl bg-ink/[0.03] p-3 hover:bg-ink/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold">
                                {logo.title}
                              </p>
                              {logo.inherited ? (
                                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-ink-muted">
                                  継承
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-ink-muted">
                              {ROLE_LABELS[logo.role] ?? logo.role}
                            </p>
                            {logo.inherited ? (
                              <p className="mt-1 truncate text-[10px] text-ink-faint">
                                {logo.subjectEntityName}から継承
                              </p>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-hairline p-5 text-center">
                      <p className="text-pretty text-xs text-ink-muted">
                        ロゴアセットはまだ登録されていません。
                      </p>
                      <Link
                        href="/logos"
                        className="mt-3 inline-block text-xs font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        アセット一覧を開く
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5" aria-label="キャンペーン成果物">
            <section className="rounded-2xl border border-hairline p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-ink-muted">
                    OUTPUTS
                  </p>
                  <h3 className="mt-1 text-balance text-lg font-semibold">
                    LP・動画
                  </h3>
                </div>
                <span className="tabular-nums text-xs text-ink-muted">
                  {business.campaigns.length}件
                </span>
              </div>

              {business.campaigns.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {business.campaigns.map((campaign) => (
                    <li
                      key={campaign.id}
                      className="rounded-xl bg-ink/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {campaign.name}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {formatDate(campaign.createdAt)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-ink-muted">
                          {VIDEO_LABELS[campaign.videoStatus]}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <a
                          href={campaign.lpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded-full border border-hairline bg-white px-3 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          LPを開く <ExternalIcon />
                        </a>
                        <Link
                          href={`/campaigns/${campaign.id}#campaign-video`}
                          className="inline-flex items-center justify-center rounded-full border border-hairline bg-white px-3 py-2 text-xs font-semibold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          動画を管理
                        </Link>
                      </div>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="mt-3 block text-center text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
                      >
                        キャンペーン詳細
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-hairline p-5 text-center">
                  <p className="text-pretty text-xs text-ink-muted">
                    この事業のLPや動画はまだありません。
                  </p>
                  <Link
                    href={`/?business=${business.id}`}
                    className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    キャンペーンを作る
                  </Link>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
