export const BRAND_TREE_REFRESH_EVENT = "logos:brand-tree-refresh";

export function refreshBrandTree() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BRAND_TREE_REFRESH_EVENT));
}
