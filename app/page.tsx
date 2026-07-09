"use client";

import { useEffect, useState } from "react";
import type { LogoData } from "@/lib/svg";
import { repo } from "@/lib/store";
import Landing from "@/components/Landing";
import Presentation from "@/components/Presentation";

async function persistLogo(data: LogoData, title: string): Promise<void> {
  try {
    const existing = await repo.listLogos();
    // Re-uploading the same file should not create a duplicate entry.
    if (existing.some((l) => l.data.svg === data.svg)) return;
    await repo.saveLogo({
      id: crypto.randomUUID(),
      title,
      role: existing.length === 0 ? "brand" : "other",
      data,
      createdAt: new Date().toISOString(),
    });
    const company = await repo.getCompany();
    if (!company.name) await repo.saveCompany({ ...company, name: title });
  } catch {
    // Persistence is best-effort in the PoC; the presentation still works.
  }
}

export default function Home() {
  const [logo, setLogo] = useState<LogoData | null>(null);
  const [name, setName] = useState("Brand");

  // Allow the admin screen to open a stored logo via /?logo=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("logo");
    if (!id) return;
    repo.getLogo(id).then((stored) => {
      if (stored) {
        setName(stored.title);
        setLogo(stored.data);
      }
    });
  }, []);

  if (!logo) {
    return (
      <Landing
        onLogo={(data, suggestedName) => {
          setName(suggestedName);
          setLogo(data);
          void persistLogo(data, suggestedName);
        }}
      />
    );
  }

  return (
    <Presentation
      logo={logo}
      name={name}
      onNameChange={setName}
      onReset={() => {
        window.history.replaceState(null, "", "/");
        setLogo(null);
      }}
    />
  );
}
