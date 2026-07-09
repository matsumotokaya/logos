"use client";

import { useState } from "react";
import type { LogoData } from "@/lib/svg";
import Landing from "@/components/Landing";
import Presentation from "@/components/Presentation";

export default function Home() {
  const [logo, setLogo] = useState<LogoData | null>(null);
  const [name, setName] = useState("Brand");

  if (!logo) {
    return (
      <Landing
        onLogo={(data, suggestedName) => {
          setName(suggestedName);
          setLogo(data);
        }}
      />
    );
  }

  return (
    <Presentation
      logo={logo}
      name={name}
      onNameChange={setName}
      onReset={() => setLogo(null)}
    />
  );
}
