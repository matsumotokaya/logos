"use client";

// Logo selector + uploader. Switching here re-renders every experiment on
// the page with the new logo — the core loop of the lab.

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import { addLogoFile, removeLogo, selectLogo } from "@/labs/motion/core/logo-store";
import LogoThumb from "./LogoThumb";

export default function LogoRail({
  logos,
  selectedId,
}: {
  logos: LabLogo[];
  selectedId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(await addLogoFile(file));
    setBusy(false);
  };

  return (
    <section className="border-b border-hairline bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-4">
        <span className="mr-1 font-mono text-[11px] tracking-widest text-ink-muted uppercase">
          Logo
        </span>
        {logos.map((logo) => (
          <div key={logo.id} className="group relative">
            <button
              type="button"
              onClick={() => selectLogo(logo.id)}
              title={logo.name}
              className={cn(
                "flex h-14 w-20 items-center justify-center rounded-lg border bg-white p-2 transition",
                logo.id === selectedId
                  ? "border-accent ring-1 ring-accent"
                  : "border-hairline hover:border-ink-faint",
              )}
            >
              <LogoThumb logo={logo} />
            </button>
            {!logo.builtin && (
              <button
                type="button"
                aria-label={`${logo.name} を削除`}
                onClick={() => removeLogo(logo.id)}
                className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-hairline bg-white text-[10px] text-ink-muted group-hover:flex hover:text-ink"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-14 w-20 items-center justify-center rounded-lg border border-dashed border-ink-faint text-xs text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {busy ? "解析中…" : "+ 追加"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,.png,image/svg+xml,image/png"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="ml-auto hidden text-[11px] text-ink-faint md:block">
          SVG推奨(PNGは対応実験のみ)。ロゴはこの端末の外に送信されない。
        </p>
      </div>
    </section>
  );
}
