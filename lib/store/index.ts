// Single access point for persistence. To move to a real database later,
// implement BrandRepo (e.g. SupabaseRepo) and swap the instance below.

import { LocalStorageRepo } from "./local";
import type { BrandRepo } from "./types";

export const repo: BrandRepo = new LocalStorageRepo();

export * from "./types";
