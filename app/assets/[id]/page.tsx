import { redirect } from "next/navigation";

export default async function LegacyAssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/logos/${id}`);
}
