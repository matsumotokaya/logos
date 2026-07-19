"use client";

import { supabase } from "@/lib/supabase/client";

/** Fetch an internal Labs endpoint with the current verified Supabase token. */
export async function labsRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  if (error || !session || session.user.is_anonymous) {
    throw new Error("Labsへのログインが必要です。");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
  });
}
