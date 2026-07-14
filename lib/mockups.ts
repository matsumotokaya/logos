export const MOCKUP_SLOT_RE = /^(mug|tote|cap)$/;

export function mockupObjectKey(
  logoId: string,
  candidateId: string,
  slot: string,
): string {
  return `logos/${logoId}/candidates/${candidateId}/mockups/${slot}.png`;
}

