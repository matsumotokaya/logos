"use client";

import { useRef, useState } from "react";
import { analyzeSvg, type LogoData } from "@/lib/svg";
import { SAMPLE_SVG, SAMPLE_NAME } from "@/lib/sample";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/config";

type Props = {
  onLogo: (logo: LogoData, suggestedName: string) => void;
};

function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Brand";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default function Landing({ onLogo }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const isSvg =
      file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    if (!isSvg) {
      setError(
        "This proof of concept accepts SVG only. PNG and Illustrator support is on the roadmap."
      );
      return;
    }
    try {
      const source = await file.text();
      const logo = analyzeSvg(source, file.name);
      onLogo(logo, nameFromFile(file.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    }
  };

  const loadSample = () => {
    setError(null);
    try {
      onLogo(analyzeSvg(SAMPLE_SVG, "sample.svg"), SAMPLE_NAME);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample.");
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-6 md:px-12">
      <header className="flex items-center justify-between py-6">
        <p className="text-lg font-medium">
          {SERVICE_NAME}
          <span className="align-super text-xs">®</span>
        </p>
        <p className="font-mono text-xs uppercase text-white/40">
          Proof of concept
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-12 pb-24">
        <div className="max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-medium leading-tight md:text-7xl">
            {SERVICE_TAGLINE}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-white/50">
            Drop a single SVG logo and get a Behance-grade brand presentation
            — construction grid, color system, app icons, favicons and mockups.
            Zero touch.
          </p>
        </div>

        <div className="w-full max-w-xl">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-8 py-14 transition-colors ${
              dragging
                ? "border-white/60 bg-white/5"
                : "border-white/20 hover:border-white/40"
            }`}
          >
            <span className="text-lg">Drop your logo here</span>
            <span className="font-mono text-xs uppercase text-white/40">
              SVG only — for now
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="sr-only"
              aria-label="Upload an SVG logo"
              aria-describedby={error ? "upload-error" : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {error && (
            <p
              id="upload-error"
              aria-live="polite"
              className="mt-3 text-sm text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={loadSample}
              className="text-sm text-white/60 underline underline-offset-4 hover:text-white"
            >
              No logo at hand? View the sample presentation
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
