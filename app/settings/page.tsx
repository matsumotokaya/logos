"use client";

import { useAuth } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm text-gray-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {note && <p className="mt-1 text-pretty text-xs text-gray-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { enabled, loading, user, isSignedIn } = useAuth();
  const accountState = !enabled
    ? "localStorage mode"
    : loading
      ? "loading"
      : isSignedIn
        ? "registered account"
        : "guest session";

  return (
    <main className="min-h-dvh bg-[#F7F7F8] text-[#111827]">
      <AppHeader section="Account" />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 md:px-10">
        <div>
          <p className="text-xs text-gray-500">Account</p>
          <h1 className="mt-1 text-balance text-2xl font-semibold">アカウント</h1>
        </div>

        <Section
          title="アカウント"
          note="ユーザー情報の表示と編集を置くための設定画面です。プロフィール編集は後続実装で接続します。"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="状態" value={accountState} />
            <Field label="メール" value={user?.email ?? "未設定"} />
            <div className="sm:col-span-2">
              <Field label="User ID" value={user?.id ?? "未作成"} />
            </div>
          </div>
        </Section>

        <Section
          title="プロフィール編集"
          note="表示名、連絡先、通知設定などをここに追加します。現時点ではデータモデルとUIの置き場だけを確保しています。"
        >
          <fieldset disabled className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">表示名</span>
              <input
                placeholder="未実装"
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">連絡先メール</span>
              <input
                placeholder="未実装"
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
              />
            </label>
          </fieldset>
        </Section>

        <DeleteAccountSection />
      </div>
    </main>
  );
}
