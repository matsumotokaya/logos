"use client";

// Authenticated fetch for the video surfaces.
//
// Deliberately not imported from app/campaigns/campaign-ui: that module also
// pulls in the campaign result digest and, through it, the Remotion CM player,
// so importing it just for a token would drag the whole CM bundle into the
// video portal.

import { ensureSession, supabase } from "@/lib/supabase/client";

export class VideoAuthRequiredError extends Error {
  constructor() {
    super("サインインしてから、もう一度お試しください。");
    this.name = "VideoAuthRequiredError";
  }
}

export async function videoFetch(path: string, init?: RequestInit): Promise<Response> {
  await ensureSession().catch(() => {});
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new VideoAuthRequiredError();
  return fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}
