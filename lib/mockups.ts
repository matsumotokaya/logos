export const MOCKUP_SLOT_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function mockupObjectKey(
  logoId: string,
  candidateId: string,
  slot: string,
): string {
  return `logos/${logoId}/candidates/${candidateId}/mockups/${slot}.png`;
}
