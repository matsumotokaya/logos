-- Functions are not dependencies of tables they mention in SQL bodies, so
-- dropping the legacy campaign tables does not remove these helpers.
drop function if exists public.can_manage_campaign(uuid);
drop function if exists public.can_view_campaign(uuid);
