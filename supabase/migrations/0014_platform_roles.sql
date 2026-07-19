-- 0014_platform_roles.sql
-- Platform-wide staff access is intentionally separate from organization
-- membership. An org admin manages one customer's workspace; a platform role
-- controls internal Logos surfaces such as Labs and the future service console.

do $$ begin
  create type public.platform_role as enum (
    'platform_admin',
    'support',
    'labs_member'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.platform_role_assignments (
  user_id    uuid not null references public.users(user_id) on delete cascade,
  role       public.platform_role not null,
  granted_by uuid references public.users(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.platform_role_assignments enable row level security;

create or replace function private.has_platform_role(
  p_roles public.platform_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.platform_role_assignments pra
    where pra.user_id = auth.uid()
      and pra.role = any(p_roles)
  );
$$;

revoke all on public.platform_role_assignments from public, anon, authenticated;
grant select on public.platform_role_assignments to authenticated;

revoke all on function private.has_platform_role(public.platform_role[])
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_platform_role(public.platform_role[])
  to authenticated;

drop policy if exists platform_roles_select_own
  on public.platform_role_assignments;
create policy platform_roles_select_own
  on public.platform_role_assignments
  for select to authenticated
  using (
    private.is_registered_user()
    and user_id = auth.uid()
  );

-- No authenticated INSERT/UPDATE/DELETE policy is intentional. Platform
-- roles are granted through an audited operator path using service_role.
