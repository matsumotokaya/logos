-- ============================================================================
-- 0003 — let the creator see their own organization
--
-- Root cause of the 403 on organization creation: `INSERT ... RETURNING`
-- (PostgREST's `return=representation`) evaluates the SELECT policy on the
-- new row *before* the AFTER-INSERT trigger has added the creator's owner
-- membership. So orgs_select (has_org_role) was false and the row came back
-- as an RLS violation, even though the INSERT itself succeeded.
--
-- Fix: the creator can always read the organizations they created. This is
-- correct on its own terms and does not depend on trigger timing.
-- Idempotent: safe to re-run.
-- ============================================================================

drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select
  using (
    created_by = auth.uid()
    or has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[])
  );

-- Verification
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'organizations' and policyname = 'orgs_select';
