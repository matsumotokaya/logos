"use client";

import { Menu } from "@base-ui/react/menu";
import type { TreeAction, TreeActionId } from "@/lib/brand-tree-actions";
import { cn } from "@/lib/cn";

// The three dots at the end of a tree row.
//
// It sits next to the row's link, never inside it: a menu trigger inside an
// anchor navigates on the way to opening. And it is always visible rather than
// appearing on hover — the sidebar is the primary navigation on touch, where
// there is no hover to reveal anything.
//
// A blocked action stays in the menu, disabled, with the reason underneath.
// Hiding it would answer "can I delete this?" with silence.

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
      <circle cx="4" cy="10" r="1.25" />
      <circle cx="10" cy="10" r="1.25" />
      <circle cx="16" cy="10" r="1.25" />
    </svg>
  );
}

export default function RowActionsMenu({
  label,
  actions,
  compact = false,
  onSelect,
}: {
  /** Names the row for screen readers: 「〜のメニュー」. */
  label: string;
  actions: TreeAction[];
  /** Leaf rows are 11px tall text; the trigger shrinks to match. */
  compact?: boolean;
  onSelect: (action: TreeActionId) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${label}のメニュー`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink data-[popup-open]:bg-ink/5 data-[popup-open]:text-ink",
          compact ? "size-6" : "size-7",
        )}
      >
        <MoreIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 outline-none"
        >
          <Menu.Popup className="w-64 rounded-xl border border-hairline bg-paper p-1.5 shadow-lg outline-none">
            {actions.map((action) => (
              <Menu.Item
                key={action.id}
                disabled={action.blockedReason !== null}
                onClick={() => onSelect(action.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-ink/5",
                  action.danger && "text-red-700 data-[highlighted]:bg-red-50",
                  action.blockedReason !== null &&
                    "cursor-default text-ink-faint data-[highlighted]:bg-transparent",
                )}
              >
                {action.label}
                {action.blockedReason ? (
                  <span className="mt-0.5 block text-pretty text-[11px] leading-snug text-ink-faint">
                    {action.blockedReason}
                  </span>
                ) : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
