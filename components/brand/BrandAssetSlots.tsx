"use client";

// The named things a brand's visual identity is made of, shown as slots.
//
// AN EMPTY SLOT HAS TO BE VISIBLE. Until now a brand with no key visual simply
// had no key visual section, so the screen could not be told apart from a
// product that has no such concept — 「無い」 and 「そういう項目が存在しない」
// looked identical. Naming the slot and saying 未指定 is the same stance the
// pipeline drawer already takes with 不足: the list of what is missing is the
// list of what to go and get.
//
// ONE COMPONENT, TWO PAGES. The brand page shows what the company has; the
// video page shows what this film is actually using. Same slots, same order,
// same words, so 「この動画は何を自前で持っているのか」 is answered by reading
// the same rows in a different place rather than by learning a second layout.

import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BrandAssetItem {
  id: string;
  name: string;
  /** Something the browser can draw. Null falls back to the name. */
  previewUrl: string | null;
  /** Small print under the name — where it came from, what it is. */
  note?: string;
  href?: string;
}

export interface BrandAssetSlot {
  key: string;
  label: string;
  /** What this slot is for, in one line. */
  hint: string;
  items: BrandAssetItem[];
  /** What to do about it being empty. Absence is a state, not an error. */
  emptyNote: string;
  /** Where the full management surface is, when there is one. */
  href?: string;
  hrefLabel?: string;
}

function Thumb({ item }: { item: BrandAssetItem }) {
  return (
    <span className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-ink/[0.03]">
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt="" className="max-h-20 w-full object-cover" />
      ) : (
        <span className="px-2 text-center text-[11px] text-ink-faint">
          プレビューなし
        </span>
      )}
    </span>
  );
}

function SlotCard({ item }: { item: BrandAssetItem }) {
  const body = (
    <>
      <Thumb item={item} />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold text-ink">
          {item.name}
        </span>
        {item.note ? (
          <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
            {item.note}
          </span>
        ) : null}
      </span>
    </>
  );
  const shell =
    "flex h-full flex-col gap-2.5 rounded-2xl border border-hairline bg-white p-3";
  return item.href ? (
    <Link
      href={item.href}
      className={cn(
        shell,
        "transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export default function BrandAssetSlots({ slots }: { slots: BrandAssetSlot[] }) {
  return (
    <div className="flex flex-col gap-5">
      {slots.map((slot) => (
        <div key={slot.key} className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
              {slot.label}
            </h3>
            {/* Said even when full, so the row means the same thing on both
                pages and a reader never has to infer what a slot is for. */}
            <span className="shrink-0 text-[11px] text-ink-faint">{slot.hint}</span>
            <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
            {slot.href && slot.items.length > 0 ? (
              <Link
                href={slot.href}
                className="shrink-0 text-[11px] text-accent hover:underline"
              >
                {slot.hrefLabel ?? "すべて管理 →"}
              </Link>
            ) : null}
          </div>
          {slot.items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {slot.items.map((item) => (
                <li key={item.id}>
                  <SlotCard item={item} />
                </li>
              ))}
            </ul>
          ) : (
            // Dashed and quiet, never amber: a brand that has not supplied a
            // key visual is not in a warning state, and the templates draw a
            // designed substitute for exactly this case.
            <p className="rounded-2xl border border-dashed border-hairline px-4 py-4 text-[12px] text-ink-muted">
              <span className="font-semibold text-ink-faint">未指定</span>
              <span className="mx-1.5 text-ink-faint">·</span>
              {slot.emptyNote}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
