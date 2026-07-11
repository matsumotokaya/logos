"use client";

// Logo info page: the canonical record of one logo (docs/data-model.md §5).
// Edits formal info (layer A: name, type, role, tree, visibility, credits,
// trademarks) and discovery tags (layer C), and shows the work history.

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ACTIVITY_LABELS,
  CREDIT_ROLE_LABELS,
  LOGO_ROLE_LABELS,
  LOGO_TYPE_LABELS,
  TRADEMARK_STATUS_LABELS,
  TRADEMARK_TYPE_LABELS,
  VISIBILITY_LABELS,
  repo,
  type CreditRole,
  type LogoCredit,
  type LogoPatch,
  type LogoRole,
  type LogoTrademark,
  type LogoType,
  type LogoVisibility,
  type StoredLogo,
  type TrademarkStatus,
  type TrademarkType,
} from "@/lib/store";
import { analyzeSvg, svgToDataUri } from "@/lib/svg";
import {
  hasSupabase,
  listMyOrgs,
  normalizeHandle,
  transferLogoToOrg,
  type Organization,
} from "@/lib/org";

// Nice classes are edited as free text ("9, 35, 42") and parsed on save.
type TrademarkDraft = Omit<LogoTrademark, "niceClasses"> & { niceClasses: string };

function toTrademarkDraft(t: LogoTrademark): TrademarkDraft {
  return { ...t, niceClasses: t.niceClasses.join(", ") };
}

function fromTrademarkDraft(d: TrademarkDraft): LogoTrademark {
  const classes = d.niceClasses
    .split(/[,、\s]+/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  return { ...d, niceClasses: [...new Set(classes)].sort((a, b) => a - b) };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  "rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none";
const labelCls = "text-xs text-gray-500";

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {note && <p className="mt-0.5 text-pretty text-xs text-gray-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function LogoInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [logo, setLogo] = useState<StoredLogo | null>(null);
  const [allLogos, setAllLogos] = useState<StoredLogo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [slugDraft, setSlugDraft] = useState("");
  const [creditsDraft, setCreditsDraft] = useState<LogoCredit[]>([]);
  const [tmDraft, setTmDraft] = useState<TrademarkDraft[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  // Orgs the viewer can transfer this logo into (owner/admin roles).
  const [adminOrgs, setAdminOrgs] = useState<Organization[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, all, orgs] = await Promise.all([
        repo.getLogo(id),
        repo.listLogos(),
        hasSupabase
          ? listMyOrgs().then((os) => os.filter((o) => o.myRole === "owner" || o.myRole === "admin"))
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setLogo(l);
      setAllLogos(all);
      setAdminOrgs(orgs);
      if (l) {
        setTitleDraft(l.title);
        setSlugDraft(l.slug ?? "");
        setCreditsDraft(l.credits);
        setTmDraft(l.trademarks.map(toTrademarkDraft));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const transfer = async (orgId: string) => {
    const target = adminOrgs.find((o) => o.id === orgId);
    if (!target) return;
    if (!window.confirm(`このロゴの所有を「${target.name || "（無名の組織）"}」に移管しますか？`)) return;
    await transferLogoToOrg(id, orgId);
    setLogo(await repo.getLogo(id));
  };

  // Persist a patch and refresh the record (activities, updatedAt) without
  // clobbering in-progress credit/trademark drafts.
  const patch = async (p: LogoPatch) => {
    await repo.updateLogo(id, p);
    const fresh = await repo.getLogo(id);
    setLogo(fresh);
  };

  if (!loaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F7F8] text-[#111827]">
        <p className="text-sm text-gray-500">読み込み中…</p>
      </div>
    );
  }

  if (!logo) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F7F7F8] text-[#111827]">
        <p className="text-sm text-gray-500">ロゴが見つかりません。</p>
        <Link href="/admin" className="text-sm underline underline-offset-2">
          管理コンソールへ戻る
        </Link>
      </div>
    );
  }

  if (logo.canEdit === false) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#F7F7F8] text-[#111827]">
        <p className="text-sm text-gray-500">このロゴを管理する権限がありません。</p>
        <Link href="/admin" className="text-sm underline underline-offset-2">
          管理コンソールへ戻る
        </Link>
      </div>
    );
  }

  // Parent candidates: everything except self and its own descendants
  // (picking a descendant would create a cycle in the tree).
  const isDescendantOfSelf = (candidate: StoredLogo): boolean => {
    const seen = new Set<string>();
    let cur: StoredLogo | undefined = candidate;
    while (cur?.parentId) {
      if (cur.parentId === id) return true;
      if (seen.has(cur.parentId)) return false;
      seen.add(cur.parentId);
      cur = allLogos.find((l) => l.id === cur!.parentId);
    }
    return false;
  };
  const parentCandidates = allLogos.filter(
    (l) => l.id !== id && !isDescendantOfSelf(l)
  );

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next || next === logo.title) {
      setTitleDraft(logo.title);
      return;
    }
    void patch({ title: next });
  };

  // Slugs share the handle charset ([a-z0-9-]); normalize on commit.
  const commitSlug = () => {
    const normalized = normalizeHandle(slugDraft);
    setSlugDraft(normalized);
    if (normalized === (logo.slug ?? "")) return;
    void patch({ slug: normalized || null });
  };

  // Visibility is an admin-level decision: personal logos are always yours to
  // set, org-owned ones require owner/admin in the owning org.
  const canAdminVisibility =
    !hasSupabase || !logo.ownerOrgId || adminOrgs.some((o) => o.id === logo.ownerOrgId);

  const addTag = () => {
    const tag = tagInput.trim();
    setTagInput("");
    if (!tag || logo.tags.includes(tag)) return;
    void patch({ tags: [...logo.tags, tag] });
  };

  const handleReplaceFile = async (file: File) => {
    setFileError(null);
    if (!(file.type === "image/svg+xml" || /\.svg$/i.test(file.name))) {
      setFileError("SVGファイルを指定してください。");
      return;
    }
    try {
      const data = analyzeSvg(await file.text(), file.name);
      await repo.replaceLogoData(id, data);
      setLogo(await repo.getLogo(id));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    }
  };

  const saveCredits = () => {
    void patch({ credits: creditsDraft.filter((c) => c.name.trim() !== "") });
  };

  const saveTrademarks = () => {
    void patch({ trademarks: tmDraft.map(fromTrademarkDraft) });
  };

  return (
    <div className="min-h-dvh bg-[#F7F7F8] text-[#111827]">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900">
            ← 管理コンソール
          </Link>
          <a href={`/p/${logo.id}`} className="text-sm text-gray-500 hover:text-gray-900">
            プレゼンを見る →
          </a>
        </header>

        <div>
          <p className="text-xs text-gray-500">ロゴ情報（正本）</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">{logo.title}</h1>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            登録 {formatDateTime(logo.createdAt)} ・ 最終更新 {formatDateTime(logo.updatedAt)}
          </p>
        </div>

        <Card title="基本情報">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>正式名称</span>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>役割</span>
              <select
                value={logo.role}
                onChange={(e) => void patch({ role: e.target.value as LogoRole })}
                className={inputCls}
              >
                {(Object.entries(LOGO_ROLE_LABELS) as [LogoRole, string][]).map(
                  ([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>ロゴ形式</span>
              <select
                value={logo.logoType ?? ""}
                onChange={(e) =>
                  void patch({ logoType: (e.target.value || null) as LogoType | null })
                }
                className={inputCls}
              >
                <option value="">未設定</option>
                {(Object.entries(LOGO_TYPE_LABELS) as [LogoType, string][]).map(
                  ([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>親ロゴ（グループ・シリーズ構造）</span>
              <select
                value={logo.parentId ?? ""}
                onChange={(e) => void patch({ parentId: e.target.value || null })}
                className={inputCls}
              >
                <option value="">なし（最上位）</option>
                {parentCandidates.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}（{LOGO_ROLE_LABELS[l.role]}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>公開スラッグ（バニティURL用）</span>
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                onBlur={commitSlug}
                placeholder="primary-mark"
                className={inputCls}
              />
              <span className="text-xs text-gray-400">
                /ハンドル/スラッグ でアクセスできます（公開ロゴのみ有効）。
              </span>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>公開範囲</span>
              <select
                value={logo.visibility}
                disabled={!canAdminVisibility}
                onChange={(e) =>
                  void patch({ visibility: e.target.value as LogoVisibility })
                }
                className={`${inputCls} sm:w-1/2`}
              >
                {(
                  Object.entries(VISIBILITY_LABELS) as [LogoVisibility, string][]
                ).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              {!canAdminVisibility && (
                <span className="text-xs text-gray-400">
                  公開範囲の変更は管理者以上のみ行えます。
                </span>
              )}
              <span className="text-xs text-gray-400">
                アクセス制御への反映はDB移行後に有効になります（現在は保存のみ）。
              </span>
            </label>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={logo.allowContact}
                  onChange={(e) => {
                    // Optimistic flip so the checkbox responds instantly;
                    // patch() re-syncs from the store afterwards.
                    const next = e.target.checked;
                    setLogo({ ...logo, allowContact: next });
                    void patch({ allowContact: next });
                  }}
                  className="size-4"
                />
                公開プレゼンにコンタクトボタンを表示する
              </label>
              <span className="text-xs text-gray-400">
                制作クレジットに連絡先（メールアドレス）があるときに表示されます。
              </span>
            </div>
          </div>
        </Card>

        {hasSupabase && (
          <Card
            title="所有者"
            note="ロゴの所有を組織に移管できます。移管してもURL・作図・制作クレジットは変わらず、組織メンバーが権限に応じて編集できるようになります。"
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">
                現在の所有:{" "}
                <span className="font-medium text-gray-900">
                  {logo.ownerOrgId
                    ? adminOrgs.find((o) => o.id === logo.ownerOrgId)?.name || "組織"
                    : "個人（あなた）"}
                </span>
              </p>
              {adminOrgs.filter((o) => o.id !== logo.ownerOrgId).length > 0 ? (
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>組織に移管</span>
                  <select
                    aria-label="移管先の組織"
                    defaultValue=""
                    onChange={(e) => e.target.value && void transfer(e.target.value)}
                    className={`${inputCls} sm:w-2/3`}
                  >
                    <option value="" disabled>
                      移管先を選択…
                    </option>
                    {adminOrgs
                      .filter((o) => o.id !== logo.ownerOrgId)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name || "（無名の組織）"}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-gray-400">
                  移管先にできる組織がありません（オーナー／管理者の組織が必要です）。
                </p>
              )}
            </div>
          </Card>
        )}

        <Card
          title="マスターファイル"
          note="差し替えは上書き更新です（バージョンは保持されません）。派生アセットと生成モックアップは新しいファイルから作り直されます。"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex aspect-[4/3] w-full max-w-60 items-center justify-center rounded-lg border border-gray-200 bg-[#F1F3F4] p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svgToDataUri(logo.data.svg)}
                alt={logo.title}
                className="max-h-full w-2/3 object-contain"
              />
            </div>
            <div className="flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                SVGを差し替え
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="sr-only"
                aria-label="SVGを差し替え"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleReplaceFile(f);
                  e.target.value = "";
                }}
              />
              <a
                href={svgToDataUri(logo.data.svg)}
                download={`${logo.title}.svg`}
                className="text-sm text-gray-900 underline underline-offset-2"
              >
                SVGをダウンロード
              </a>
              {fileError && (
                <p aria-live="polite" className="text-pretty text-sm text-red-600">
                  {fileError}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card title="タグ" note="ギャラリー・図鑑での絞り込みに使われます。">
          <div className="flex flex-wrap items-center gap-2">
            {logo.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`タグ「${tag}」を削除`}
                  onClick={() =>
                    void patch({ tags: logo.tags.filter((t) => t !== tag) })
                  }
                  className="text-gray-400 hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="タグを追加…"
              aria-label="タグを追加"
              className={`${inputCls} w-40`}
            />
            <button
              type="button"
              onClick={addTag}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:border-gray-900"
            >
              追加
            </button>
          </div>
        </Card>

        <Card
          title="制作クレジット"
          note="制作者・制作会社の情報です。サービス外の方も登録できます。"
        >
          <div className="flex flex-col gap-3">
            {creditsDraft.length === 0 && (
              <p className="text-sm text-gray-400">クレジットは未登録です。</p>
            )}
            {creditsDraft.map((c, i) => (
              <div
                key={c.id}
                className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]"
              >
                <select
                  value={c.role}
                  aria-label="クレジットの役割"
                  onChange={(e) =>
                    setCreditsDraft((d) =>
                      d.map((x, j) =>
                        j === i ? { ...x, role: e.target.value as CreditRole } : x
                      )
                    )
                  }
                  className={inputCls}
                >
                  {(Object.entries(CREDIT_ROLE_LABELS) as [CreditRole, string][]).map(
                    ([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    )
                  )}
                </select>
                <input
                  value={c.name}
                  placeholder="名前・会社名"
                  aria-label="クレジットの名前"
                  onChange={(e) =>
                    setCreditsDraft((d) =>
                      d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                    )
                  }
                  className={inputCls}
                />
                <input
                  value={c.contact}
                  placeholder="連絡先（メール・URL）"
                  aria-label="クレジットの連絡先"
                  onChange={(e) =>
                    setCreditsDraft((d) =>
                      d.map((x, j) =>
                        j === i ? { ...x, contact: e.target.value } : x
                      )
                    )
                  }
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setCreditsDraft((d) => d.filter((_, j) => j !== i))}
                  className="justify-self-start text-xs text-red-600 hover:text-red-800 sm:justify-self-auto"
                >
                  削除
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setCreditsDraft((d) => [
                    ...d,
                    { id: crypto.randomUUID(), role: "designer", name: "", contact: "" },
                  ])
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:border-gray-900"
              >
                ＋ 追加
              </button>
              <button
                type="button"
                onClick={saveCredits}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                保存
              </button>
            </div>
          </div>
        </Card>

        <Card
          title="商標情報"
          note="登録状況・区分・指定商品役務など。入力は任意ですが、正本としての信頼性を高めます。"
        >
          <div className="flex flex-col gap-4">
            {tmDraft.length === 0 && (
              <p className="text-sm text-gray-400">商標情報は未登録です。</p>
            )}
            {tmDraft.map((t, i) => {
              const set = (p: Partial<TrademarkDraft>) =>
                setTmDraft((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));
              return (
                <div key={t.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>ステータス</span>
                      <select
                        value={t.status}
                        onChange={(e) => set({ status: e.target.value as TrademarkStatus })}
                        className={inputCls}
                      >
                        {(
                          Object.entries(TRADEMARK_STATUS_LABELS) as [
                            TrademarkStatus,
                            string,
                          ][]
                        ).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>商標タイプ</span>
                      <select
                        value={t.trademarkType ?? ""}
                        onChange={(e) =>
                          set({
                            trademarkType: (e.target.value || null) as TrademarkType | null,
                          })
                        }
                        className={inputCls}
                      >
                        <option value="">未設定</option>
                        {(
                          Object.entries(TRADEMARK_TYPE_LABELS) as [TrademarkType, string][]
                        ).map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>出願先</span>
                      <input
                        value={t.jurisdiction}
                        placeholder="JP / US / WIPO…"
                        onChange={(e) => set({ jurisdiction: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className={labelCls}>登録番号</span>
                      <input
                        value={t.registrationNo}
                        placeholder="第0000000号"
                        onChange={(e) => set({ registrationNo: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                      <span className={labelCls}>区分（ニース分類 1〜45）</span>
                      <input
                        value={t.niceClasses}
                        placeholder="9, 35, 42"
                        onChange={(e) => set({ niceClasses: e.target.value })}
                        className={`${inputCls} tabular-nums`}
                      />
                    </label>
                    <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                      <span className={labelCls}>指定商品・役務</span>
                      <input
                        value={t.goodsServices}
                        placeholder="電子計算機用プログラム、広告業…"
                        onChange={(e) => set({ goodsServices: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTmDraft((d) => d.filter((_, j) => j !== i))}
                    className="mt-2 text-xs text-red-600 hover:text-red-800"
                  >
                    この商標情報を削除
                  </button>
                </div>
              );
            })}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setTmDraft((d) => [
                    ...d,
                    {
                      id: crypto.randomUUID(),
                      status: "registered",
                      jurisdiction: "JP",
                      registrationNo: "",
                      trademarkType: null,
                      niceClasses: "",
                      goodsServices: "",
                    },
                  ])
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:border-gray-900"
              >
                ＋ 追加
              </button>
              <button
                type="button"
                onClick={saveTrademarks}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                保存
              </button>
            </div>
          </div>
        </Card>

        <Card title="作業履歴" note="このロゴに対する操作の記録です（担当者の記録はアカウント機能で有効になります）。">
          {logo.activities.length === 0 ? (
            <p className="text-sm text-gray-400">履歴はまだありません。</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {[...logo.activities].reverse().map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 text-sm">
                  <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                    {formatDateTime(a.at)}
                  </span>
                  <span>{ACTIVITY_LABELS[a.action]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
