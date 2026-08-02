import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organization管理",
  robots: { index: false, follow: false },
};

export default function OrganizationsIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <h1 className="text-balance font-display text-3xl font-semibold">
        Organization
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-sm text-ink-muted">
        左の一覧から会社・個人などのOrganizationを選択してください。企業情報、コーポレートブランド、配下の事業を管理できます。
      </p>
    </main>
  );
}
