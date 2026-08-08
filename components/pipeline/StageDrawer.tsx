"use client";

// One pipeline stage, opened over the deliverable instead of replacing it.
// Covering only part of the screen is the point: the thing being built stays
// visible behind, so running a stage never feels like leaving it.

import { useEffect, useRef } from "react";

export default function StageDrawer({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes. The drawer covers most of the screen, so offering only the
  // × button would make it read as a trap.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-hairline bg-paper shadow-xl focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-6 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
