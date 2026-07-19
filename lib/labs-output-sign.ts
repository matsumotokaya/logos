import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 60 * 60;

function secret(): string | null {
  return process.env.LABS_OUTPUT_URL_SECRET?.trim() || null;
}

function signature(key: string, name: string, expiresAt: number): string {
  return createHmac("sha256", key)
    .update(`${name}:${expiresAt}`)
    .digest("base64url");
}

export function signedLabsOutputUrl(name: string): string {
  return signedLabsUrl(`/api/labs/generative/outputs/${name}`, name);
}

export function verifyLabsOutputSignature(
  name: string,
  expiresAtRaw: string | null,
  providedSignature: string | null,
): boolean {
  return verifyLabsSignature(name, expiresAtRaw, providedSignature);
}

/** Generic variant: sign any Labs URL for header-less access (new tab, <img>). */
export function signedLabsUrl(pathname: string, token: string): string {
  const key = secret();
  if (!key) return pathname;

  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${pathname}?exp=${expiresAt}&sig=${signature(key, token, expiresAt)}`;
}

export function verifyLabsSignature(
  token: string,
  expiresAtRaw: string | null,
  providedSignature: string | null,
): boolean {
  const key = secret();
  // Local development remains zero-config. Production requires a secret.
  if (!key) return process.env.NODE_ENV !== "production";
  if (!expiresAtRaw || !providedSignature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return false;

  const expected = Buffer.from(signature(key, token, expiresAt));
  const provided = Buffer.from(providedSignature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
