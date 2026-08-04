// Event promo template — the labs-side preview of the bundled brief.
//
// The template's real home is under a brand: /brands/[id]/video/[videoId].
// This page stays as the internal bench for the bundled brief (handy for
// tuning the composition without creating a video row) and renders the exact
// same workspace component, so the two can never show different things.

import type { Metadata } from "next";
import Link from "next/link";
import LabHeader, { LAB_CONTENT_WIDTH } from "@/labs/shared/components/LabHeader";
import { cn } from "@/lib/cn";
import EventVideoWorkspace from "@/components/video/EventVideoWorkspace";
import { sake2026Brief } from "@/remotion/event/briefs/sake-2026";

export const metadata: Metadata = {
  title: "Event PV — イベントPVテンプレート",
  robots: { index: false, follow: false },
};

export default function EventPromoPage() {
  const brief = sake2026Brief;

  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <LabHeader
        current={{ name: "Event PV", titleJa: "イベントPVテンプレート", mode: "integration" }}
      />

      <main className={cn("mx-auto px-6 py-8 md:px-10", LAB_CONTENT_WIDTH)}>
        <header className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            {brief.presenter}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">
            {brief.title}
          </h2>
          <p className="mt-1 text-[12px] text-ink-muted">{brief.seriesLabel}</p>
        </header>

        <p className="mt-4 rounded-xl border border-hairline bg-ink/[0.03] px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
          これはバンドル済みブリーフの検証台です。実運用ではブランド配下の動画として登録し、
          <Link href="/brands" className="mx-1 text-accent hover:underline">
            Brand Manager
          </Link>
          の「動画」から追加・編集します。MP4は{" "}
          <code className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px]">npm run event:render</code>{" "}
          で書き出します。明朝体はOSのフォントを使うため、環境によって字面が変わります。
        </p>

        <div className="mt-6">
          <EventVideoWorkspace brief={brief} />
        </div>
      </main>
    </div>
  );
}
