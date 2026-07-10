-- ============================================================================
-- 0002 — organization bootstrap + policy re-assert
--
-- Fixes two issues found while driving the app against the live project:
--  1. Chicken-and-egg: org_members writes require an existing owner/admin
--     membership, so the creator of a new organization could never insert
--     their own first membership. A security-definer trigger now adds the
--     creator as owner automatically.
--  2. organizations INSERT was rejected by RLS (42501) for authenticated
--     anonymous users even though the equivalent logos policy passed.
--     The policies are dropped and re-created here, and the diagnostics at
--     the end print what is actually active.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Creator becomes owner on organization insert.
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.org_members (org_id, user_id, role)
    values (new.org_id, new.created_by, 'owner')
    on conflict (org_id, user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- 2. Re-assert organization policies.
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select
  using (has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[]));

drop policy if exists orgs_insert on public.organizations;
create policy orgs_insert on public.organizations for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations for update
  using (has_org_role(org_id, array['owner']::public.org_role[]));

-- 3. Diagnostics — paste this output back.
select policyname, cmd, roles::text, coalesce(with_check, qual, '-') as rule
from pg_policies
where schemaname = 'public' and tablename in ('organizations', 'org_members')
order by tablename, policyname;
