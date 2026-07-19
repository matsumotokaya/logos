"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { usePlatformAccess } from "@/lib/use-platform-access";

export default function LabsAccessGate({ children }: { children: ReactNode }) {
  const { enabled, loading: authLoading, isSignedIn } = useAuth();
  const { loading: accessLoading, canAccessLabs } = usePlatformAccess();

  if (authLoading || (isSignedIn && accessLoading)) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper text-ink">
        <AppHeader variant="labs" />
        <main className="flex flex-1 items-center justify-center px-6">
          <p role="status" className="text-pretty text-sm text-ink-muted">
            アクセス権を確認しています…
          </p>
        </main>
      </div>
    );
  }

  if (!enabled || !isSignedIn || !canAccessLabs) {
    return (
      <div className="min-h-dvh bg-paper text-ink">
        <AppHeader variant="labs" />
        <main className="mx-auto flex max-w-xl flex-col items-start px-6 py-20 md:px-10 md:py-28">
          <p className="font-mono text-xs uppercase text-ink-faint">Internal access</p>
          <h1 className="mt-3 font-display text-3xl font-medium text-balance">
            Labsは社内向けの研究環境です
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-ink-muted">
            {!isSignedIn
              ? "アクセスするには、Labs権限が付与されたアカウントでサインインしてください。"
              : "このアカウントにはLabs権限がありません。platform_adminまたはlabs_memberの付与が必要です。"}
          </p>
          <Link
            href="/"
            className="mt-8 bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent"
          >
            ホームへ戻る
          </Link>
        </main>
      </div>
    );
  }

  return children;
}
