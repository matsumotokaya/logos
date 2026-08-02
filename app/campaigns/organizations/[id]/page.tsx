import { redirect } from "next/navigation";

export default async function LegacyOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/organizations/${id}`);
}
