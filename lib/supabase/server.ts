import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function createServerSupabase(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export function createServerSupabaseForToken(accessToken: string): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export type VerifiedUser = {
  token: string;
  id: string;
  /** Guests (and unconfirmed email signups) stay anonymous — see lib/auth. */
  isAnonymous: boolean;
};

export async function requireUser(req: Request): Promise<VerifiedUser> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized");

  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  return {
    token,
    id: data.user.id,
    isAnonymous: data.user.is_anonymous ?? false,
  };
}

export async function requireAccessToken(req: Request): Promise<string> {
  return (await requireUser(req)).token;
}
