"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LogoData } from "@/lib/svg";
import { createStoredLogo, repo } from "@/lib/store";
import { newLogoId } from "@/lib/id";
import Landing from "@/components/Landing";

export default function Home() {
  const router = useRouter();

  // Legacy /?logo=<id> links redirect to the permalink.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("logo");
    if (id) router.replace(`/p/${id}`);
  }, [router]);

  const handleLogo = async (data: LogoData, suggestedName: string) => {
    // Re-uploading the same file opens the existing entry instead of duplicating it.
    const existing = await repo.listLogos();
    const dup = existing.find((l) => l.data.svg === data.svg);
    if (dup) {
      router.push(`/p/${dup.id}`);
      return;
    }

    const id = newLogoId();
    await repo.saveLogo(
      createStoredLogo({
        id,
        title: suggestedName,
        role: existing.length === 0 ? "brand" : "other",
        data,
      })
    );
    // Naming the company profile is best-effort — it must never block the
    // presentation from opening.
    try {
      const company = await repo.getCompany();
      if (!company.name) await repo.saveCompany({ ...company, name: suggestedName });
    } catch {
      // ignore
    }
    router.push(`/p/${id}`);
  };

  return <Landing onLogo={handleLogo} />;
}
