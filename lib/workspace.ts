"use client";

// Which workspace the user is looking at.
//
// An Organization is one world (docs/deliverable-architecture.md §19.2): the
// brand tree, the members and the quotas all belong to it, and nothing spans
// two. So the app shows one at a time and switching means leaving this world
// for another — the same move as switching businesses in Stripe.
//
// The choice lives in localStorage rather than the URL or a column: it is a
// per-device preference about where to look, not a fact about the account, and
// every screen that matters already carries its own ids in the path.

const KEY = "logos.workspace.current";

/** The id the user last chose, or null when they never have (or storage is off). */
export function readCurrentWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // private window, blocked storage — fall back to the default
  }
}

export function writeCurrentWorkspaceId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Losing the preference is survivable; failing to render is not.
  }
}

/**
 * The workspace to show, given what the user picked and what they can see.
 *
 * A stored id that is no longer readable (left the org, deleted, another
 * account on this device) must not blank the screen, so it falls back to the
 * first workspace instead of being trusted.
 */
export function resolveWorkspace<T extends { id: string }>(
  workspaces: T[],
  storedId: string | null,
): T | null {
  if (workspaces.length === 0) return null;
  return workspaces.find((workspace) => workspace.id === storedId) ?? workspaces[0];
}
