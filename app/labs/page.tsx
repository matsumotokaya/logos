// Labs index — the R&D constellation. Server-rendered, internal, noindex.

import type { Metadata } from "next";
import Link from "next/link";
import { LABS } from "@/labs/directory";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Labs — R&D",
  robots: { index: false, follow: false },
};

export default function LabsIndexPage() {
  return (
    <div className="min-h-screen flex-1 bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h1 className="font-display text-sm font-semibold tracking-tight">Labs</h1>
          <p className="hidden text-[11px] text-ink-muted sm:block">
            — 表現の研究開発。判断基準は全ラボ共通:「ロゴが立派に見えるか」
          </p>
          <Link href="/" className="ml-auto text-xs text-ink-muted transition hover:text-ink">
            ← 本体へ戻る
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="max-w-3xl text-sm leading-relaxed text-ink-muted">
          プロダクトの最初の体験——アップロードされたロゴが立派に見えること——を作るための研究所群。
          各レイヤーは技術の階層であると同時に、コストと希少性と課金の階段でもある
          (下層のSVGモーションは限界費用ゼロで全員に、上層の映像生成は重課金で)。
          研究所ごとに独立したサンドボックスとして運用する。
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {LABS.map((lab) => (
            <Link
              key={lab.slug}
              href={`/labs/${lab.slug}`}
              className={cn(
                "group flex flex-col rounded-xl border bg-white p-6 transition",
                lab.status === "active"
                  ? "border-hairline hover:border-accent hover:shadow-sm"
                  : "border-dashed border-ink-faint hover:border-ink-muted",
              )}
            >
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {lab.name}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    lab.status === "active"
                      ? "bg-accent text-white"
                      : "border border-dashed border-ink-faint text-ink-muted",
                  )}
                >
                  {lab.status === "active" ? "稼働中" : "準備中"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{lab.titleJa}</p>
              <p className="mt-3 text-sm leading-relaxed">{lab.tagline}</p>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">{lab.layer}</p>
              <span
                className={cn(
                  "mt-4 text-xs",
                  lab.status === "active"
                    ? "text-accent"
                    : "text-ink-muted group-hover:text-ink",
                )}
              >
                {lab.status === "active" ? "ラボに入る →" : "計画を見る →"}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
