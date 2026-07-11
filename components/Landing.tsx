"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { analyzeSvg, type LogoData } from "@/lib/svg";
import { SERVICE_NAME } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Gallery from "@/components/Gallery";
import Account from "@/components/Account";

type Props = {
  onLogo: (logo: LogoData, suggestedName: string) => Promise<void>;
};

function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Brand";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default function Landing({ onLogo }: Props) {
  const { dict } = useI18n();
  const reducedMotion = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const handleFile = async (file: File) => {
    setError(null);
    const isSvg =
      file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    if (!isSvg) {
      setError(dict.landing.errors.svgOnly);
      return;
    }
    try {
      const source = await file.text();
      const logo = analyzeSvg(source, file.name);
      await onLogo(logo, nameFromFile(file.name));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : dict.landing.errors.readFailed
      );
    }
  };

  const container = {
    hidden: {},
    show: {
      transition: reducedMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.07 },
    },
  };
  const item = {
    hidden: reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0 : 0.45,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <main
      className="relative flex min-h-dvh flex-col bg-paper text-ink"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      {/* Page-wide drag-over frame: hairline accent, no fills, no glow. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-2 z-50 border border-accent transition-opacity duration-150",
          dragging ? "opacity-100" : "opacity-0"
        )}
      />

      <header className="flex items-center justify-between border-b border-hairline px-6 py-5 md:px-10">
        <p className="font-display text-xl font-medium">
          {SERVICE_NAME}
          <span className="align-super text-[0.55em]">®</span>
        </p>
        <div className="flex items-center gap-6">
          <LanguageSwitcher />
          <Account />
          <a
            href="/admin"
            className="font-mono text-xs uppercase text-ink-muted transition-colors hover:text-ink"
          >
            {dict.header.admin}
          </a>
        </div>
      </header>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex min-h-[70dvh] w-full max-w-6xl flex-col justify-center px-6 py-16 md:px-10 md:py-24"
      >
        <motion.p
          variants={item}
          className="font-mono text-xs uppercase text-ink-muted"
        >
          <span aria-hidden="true" className="mr-3 inline-block size-2 bg-accent align-middle" />
          {dict.landing.kicker}
        </motion.p>

        <motion.h1
          variants={item}
          className="mt-6 max-w-5xl text-balance font-display text-5xl font-medium leading-[0.98] md:text-[7vw] md:leading-[0.95]"
        >
          {dict.landing.headline}
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-8 max-w-prose text-pretty text-lg text-ink-muted"
        >
          {dict.landing.sub}
        </motion.p>

        <motion.div variants={item} className="mt-12">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-describedby={error ? "upload-error" : undefined}
              className="bg-ink px-8 py-4 text-sm font-medium text-paper transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {dict.landing.upload}
            </button>
            <div className="font-mono text-xs uppercase text-ink-faint">
              <p className={cn("transition-colors", dragging && "text-accent")}>
                {dict.landing.drop}
              </p>
              <p className="mt-1">{dict.landing.svgOnly}</p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="sr-only"
            aria-label={dict.landing.upload}
            aria-describedby={error ? "upload-error" : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          {error && (
            <p
              id="upload-error"
              aria-live="polite"
              className="mt-4 max-w-prose text-pretty text-sm text-red-600"
            >
              {error}
            </p>
          )}
          <div className="mt-8">
            <Link
              href="/p/sample"
              className="text-sm text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
            >
              {dict.landing.sample}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </motion.div>
      </motion.div>

      <Gallery />

      <footer className="border-t border-hairline px-6 py-5 md:px-10">
        <p className="font-mono text-xs text-ink-faint">
          {dict.landing.privacy}
        </p>
      </footer>
    </main>
  );
}
