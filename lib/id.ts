// Short opaque IDs for permanent URLs (/p/[id]). Unguessable and free of
// ownership information, so links survive transfers (docs/account-design.md).

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newLogoId(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}
