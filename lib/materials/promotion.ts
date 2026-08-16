// What a material's scope may become, and what to say when it may not.
//
// docs/asset-normalization.md §12 / §14-5. The rules are not this module's
// invention — they are migration 0028's promotion trigger and its two update
// policies, stated in Japanese. The screen is not the authority; the server
// checks the same things again, and the database refuses regardless.
//
// Kept separate from the route so the wording can be tested without a
// database, the same split lib/brand-tree-actions.ts and
// lib/event-cm/panel-actions.ts already use.

/** take → work → brand. Widening only; the trigger refuses every narrowing. */
export const SCOPE_RANK = { take: 1, work: 2, brand: 3 } as const;

export type MaterialScope = keyof typeof SCOPE_RANK;

export const isMaterialScope = (value: unknown): value is MaterialScope =>
  typeof value === "string" && value in SCOPE_RANK;

export type PromotionDecision =
  | { can: true; from: MaterialScope; to: MaterialScope }
  | { can: false; reason: string };

/**
 * May this material be widened to that scope?
 *
 * Widening is one-way and permanent, which is why the screen asks twice. It is
 * not destructive — the id and the R2 key never change, so everything already
 * pointing at the material keeps working — but 「戻せます」 would be false.
 */
export function promotionTo(
  material: { scope: string; work_id?: string | null },
  target: string,
): PromotionDecision {
  if (!isMaterialScope(material.scope)) {
    return { can: false, reason: "この素材のスコープを読めませんでした" };
  }
  if (!isMaterialScope(target)) {
    return { can: false, reason: "そのスコープは指定できません" };
  }

  const from = SCOPE_RANK[material.scope];
  const to = SCOPE_RANK[target];

  if (to === from) {
    return {
      can: false,
      reason:
        target === "brand"
          ? "この素材はすでにブランドの基盤にあります"
          : "この素材はすでにそのスコープにあります",
    };
  }
  // Stated as a property of the material rather than of the request: narrowing
  // is refused for everyone, admins included, because it would strand takes
  // that depend on the wider scope (0028).
  if (to < from) {
    return { can: false, reason: "素材のスコープは広げることしかできません" };
  }
  if (target === "work" && !material.work_id) {
    return {
      can: false,
      reason: "この素材はどの案件にも属していないので、案件へは上げられません",
    };
  }

  return { can: true, from: material.scope, to: target };
}

/**
 * What to say when the database refused the widening.
 *
 * RLS makes a forbidden update return zero rows rather than an error, so a
 * refusal and a missing row look identical from the client. The route tells
 * them apart by reading first; this supplies the sentence.
 */
export const promotionRefusal = (target: string): string =>
  target === "brand"
    ? "ブランドの基盤に入れられるのは、このブランドの管理者だけです"
    : "この素材を編集する権限がありません";
