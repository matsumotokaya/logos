// Shared browser Supabase client. Both the persistence layer (SupabaseRepo)
// and the auth layer (lib/auth) use this single instance so they observe the
// same session — including the anonymous session guests start with.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// The placeholders keep this module importable when env vars are absent
// (localStorage mode); nothing calls the client in that case.
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

// Establish a session, signing in anonymously on first contact so guests can
// upload immediately (docs/account-design.md §1). Both the auth layer and the
// repo call this; the in-flight guard dedupes the concurrent first calls so we
// never create two anonymous users. Always returns the *current* session id,
// so it stays correct across upgrade and sign-out.
let anonInFlight: Promise<void> | null = null;

export async function ensureSession(): Promise<string | null> {
  if (!hasSupabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  // Clearing the latch in `finally` matters: settling it only on success leaves
  // every later call awaiting the same rejected promise, so one network blip
  // disables anonymous sessions for the lifetime of the page.
  const inFlight = (anonInFlight ??= supabase.auth
    .signInAnonymously()
    .then(({ error }) => {
      if (error) throw new Error(error.message);
    })
    .finally(() => {
      anonInFlight = null;
    }));
  await inFlight;
  const { data: after } = await supabase.auth.getSession();
  return after.session?.user.id ?? null;
}
