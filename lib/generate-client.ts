// Client-side entry point for the paid AI generation API (/api/generate).
// The server requires a registered (non-anonymous) Supabase user and enforces
// a daily quota; this helper attaches the session token and normalizes the
// failure modes so scene components can show localized messages.

import { ensureSession, hasSupabase, supabase } from "@/lib/supabase/client";
import type { Dict } from "@/lib/i18n/dictionaries";

export type GenerationErrorCode = "auth" | "quota" | "other";

export class GenerationError extends Error {
  code: GenerationErrorCode;

  constructor(message: string, code: GenerationErrorCode) {
    super(message);
    this.code = code;
  }
}

export function generationErrorMessage(
  error: unknown,
  gen: Dict["gen"]
): string {
  if (error instanceof GenerationError) {
    if (error.code === "auth") return gen.signInRequired;
    if (error.code === "quota") return gen.quotaReached;
    return error.message;
  }
  return error instanceof Error ? error.message : gen.failed;
}

export async function requestGeneration(input: {
  target: "mug" | "tote" | "cap" | "wall";
  imageBase64: string;
  brandName: string;
  primaryHex: string;
}): Promise<string> {
  if (!hasSupabase) {
    // localStorage mode has no accounts, so the cost-gated API is unavailable.
    throw new GenerationError("Generation requires an account.", "auth");
  }
  await ensureSession();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new GenerationError("Generation requires an account.", "auth");

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.image) {
    const code: GenerationErrorCode =
      res.status === 401 || res.status === 403
        ? "auth"
        : res.status === 429
          ? "quota"
          : "other";
    throw new GenerationError(payload?.error || "Generation failed.", code);
  }
  return payload.image as string;
}
