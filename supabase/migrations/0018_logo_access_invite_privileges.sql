-- 0018_logo_access_invite_privileges.sql
-- Supabase grants broad table privileges to authenticated by default. Narrow
-- invite access to the operations and mutable columns used by the client.

revoke all on public.logo_access_invites from authenticated;

grant select, insert, delete on public.logo_access_invites to authenticated;
grant update (role, expires_at, updated_at)
  on public.logo_access_invites to authenticated;
