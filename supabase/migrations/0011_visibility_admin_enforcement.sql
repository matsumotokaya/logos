-- 0011_visibility_admin_enforcement.sql
-- Server-side enforcement of the rule the UI already applies: changing a
-- logo's visibility requires admin rights (personal owner, or org
-- owner/admin via can_admin_logo). Editors keep every other update right
-- through the logos_update RLS policy; RLS is row-level, so the
-- column-level rule lives in this trigger. Closes the 0001 NOTE.
-- Idempotent; safe to re-run.

create or replace function public.enforce_visibility_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility is distinct from old.visibility
     and not public.can_admin_logo(old.id) then
    raise exception 'Only an owner or admin can change logo visibility.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists logos_visibility_admin on public.logos;
create trigger logos_visibility_admin
  before update of visibility on public.logos
  for each row execute function public.enforce_visibility_admin();
