// Server-only signing for mockup image URLs (docs/launch-plan.md M1).
// <img src> cannot carry an Authorization header, so private mockup images
// are protected by a short-lived HMAC query signature instead: the
// authenticated list/save APIs mint signed URLs, and the public image GET
// verifies them. Public/unlisted logos are served without a signature.
// With MOCKUP_URL_SECRET unset, signing is off and only public logos work.

import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 60 * 60;

function secret(): string | null {
  return process.env.MOCKUP_URL_SECRET?.trim() || null;
}

function compute(
  key: string,
  logoId: string,
  candidateId: string,
  slot: string,
  exp: number,
): string {
  return createHmac("sha256", key)
    .update(`${logoId}/${candidateId}/${slot}:${exp}`)
    .digest("base64url");
}

/** Image URL for a slot; carries an expiring signature when signing is on. */
export function mockupImageUrl(
  logoId: string,
  candidateId: string,
  slot: string,
): string {
  const path = `/api/mockups/${logoId}/${candidateId}/${slot}`;
  const key = secret();
  if (!key) return path;
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${path}?exp=${exp}&sig=${compute(key, logoId, candidateId, slot, exp)}`;
}

export function verifyMockupSignature(
  logoId: string,
  candidateId: string,
  slot: string,
  expRaw: string | null,
  sig: string | null,
): boolean {
  const key = secret();
  if (!key || !expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(compute(key, logoId, candidateId, slot, exp));
  const provided = Buffer.from(sig);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
