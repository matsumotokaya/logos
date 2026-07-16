-- ============================================================================
-- 0009 - asset registry FK indexes
--
-- Supabase advisor reports unindexed foreign keys after the asset registry
-- migration. These indexes keep owner/user/org updates and deletes from
-- scanning registry tables as the asset model grows.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 0007 lifecycle FKs whose existing read indexes do not start with the FK
-- column Supabase checks.
create index if not exists logo_asset_runs_asset_definition_idx
  on public.logo_asset_runs (asset_definition_id);
create index if not exists logo_asset_runs_triggered_by_idx
  on public.logo_asset_runs (triggered_by)
  where triggered_by is not null;

-- Composite FK from logo_variants(lockup_id, candidate_id) to logo_lockups.
create index if not exists logo_variants_lockup_candidate_idx
  on public.logo_variants (lockup_id, candidate_id);

-- Transfer workflow FKs. Some query-oriented indexes exist in 0008, but these
-- exact FK indexes keep referential actions predictable and silence advisor
-- warnings without changing policy behavior.
create index if not exists logo_transfer_requests_source_user_idx
  on public.logo_transfer_requests (source_owner_user_id)
  where source_owner_user_id is not null;
create index if not exists logo_transfer_requests_source_org_idx
  on public.logo_transfer_requests (source_owner_org_id)
  where source_owner_org_id is not null;
create index if not exists logo_transfer_requests_proposed_user_idx
  on public.logo_transfer_requests (proposed_owner_user_id)
  where proposed_owner_user_id is not null;
create index if not exists logo_transfer_requests_proposed_org_idx
  on public.logo_transfer_requests (proposed_owner_org_id)
  where proposed_owner_org_id is not null;
create index if not exists logo_transfer_requests_responded_by_idx
  on public.logo_transfer_requests (responded_by)
  where responded_by is not null;
