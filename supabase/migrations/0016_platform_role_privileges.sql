-- 0016_platform_role_privileges.sql
-- Existing projects may inherit broad table grants from the public schema's
-- default privileges. RLS already blocks writes, but platform-role assignment
-- should also be read-only at the SQL privilege layer for application users.

revoke all on public.platform_role_assignments
  from public, anon, authenticated;
grant select on public.platform_role_assignments to authenticated;
