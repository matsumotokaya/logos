// Single access point for persistence. With Supabase env vars present the
// app runs on the real database (anonymous auth, RLS); without them it falls
// back to localStorage so the PoC still works fully offline.

import { hasSupabase } from "@/lib/supabase/client";
import { LocalStorageRepo } from "./local";
import { SupabaseRepo } from "./supabase";
import type { BrandRepo } from "./types";

export const repo: BrandRepo = hasSupabase
  ? new SupabaseRepo()
  : new LocalStorageRepo();

export * from "./types";
