import type { Metadata } from "next";
import WorkspaceDetail from "./WorkspaceDetail";

export const metadata: Metadata = {
  title: "ワークスペース",
  robots: { index: false, follow: false },
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkspaceDetail id={id} />;
}
