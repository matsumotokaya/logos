"use client";

// Logo selector + uploader. Switching here re-renders every experiment on
// the page with the new logo — the core loop of the lab.

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LabLogo } from "@/labs/motion/core/experiment-api";
import { addLogoFile, selectLogo } from "@/labs/motion/core/logo-store";
import LogoThumb from "./LogoThumb";

export default function LogoRail({
  logos,
  selectedId,
  note = "追加したSVGはアカウントの正本ロゴとして保存され、実験の描画はブラウザ内で行われます。",
}: {
  logos: LabLogo[];
  selectedId: string;
  /** Privacy/usage note on the right (labs sharing this rail differ here). */
  note?: string;
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4">
        <span className="mr-1 font-mono text-[11px] tracking-widest text-ink-muted uppercase">
          Logo
        </span>
        {logos.map((logo) => (
          <div key={logo.id} className="shrink-0">
            <button
              type="button"
              onClick={() => selectLogo(logo.id)}
              title={logo.name}
              aria-label={`${logo.name}を選択`}
              className={cn(
                "flex h-14 w-20 items-center justify-center rounded-lg border bg-white p-2 transition",
                logo.id === selectedId
                  ? "border-accent ring-1 ring-accent"
                  : "border-hairline hover:border-ink-faint",
              )}
            >
              <LogoThumb logo={logo} />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-faint text-xs text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {busy ? "解析中…" : "+ 追加"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="ml-auto hidden text-[11px] text-ink-faint md:block">{note}</p>
      </div>
    </section>
  );
}
