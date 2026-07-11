-- ============================================================================
-- 0004 — organization invitations + auto-accept on sign-up
--
-- Members are invited by email (docs/account-design.md §4). A pending invite
-- becomes a real membership automatically the moment the invitee's email lands
-- on their account — whether they sign up with email/password or OAuth — so no
-- separate "accept" step or working SMTP is required.
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.org_invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(org_id) on delete cascade,
  email      text not null,
  role       public.org_role not null default 'viewer',
  invited_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.org_invites enable row level security;

-- One pending invite per (org, email), case-insensitive.
create unique index if not exists org_invites_org_email_uq
  on public.org_invites (org_id, lower(email));

-- Only owner/admin of the org manage its invites.
drop policy if exists invites_rw on public.org_invites;
create policy invites_rw on public.org_invites for all
  using (has_org_role(org_id, array['owner','admin']::public.org_role[]))
  with check (has_org_role(org_id, array['owner','admin']::public.org_role[]));

-- Turn every pending invite for this email into a membership, then clear them.
create or replace function public.accept_pending_invites(p_email text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email = '' then
    return;
  end if;
  insert into public.org_members (org_id, user_id, role)
  select i.org_id, p_user_id, i.role
  from public.org_invites i
  where lower(i.email) = lower(p_email)
  on conflict (org_id, user_id) do nothing;
  delete from public.org_invites where lower(email) = lower(p_email);
end $$;

-- Re-declare the auth sync triggers to also accept invites on sign-up / email
-- confirmation (extends 0001's handle_new_auth_user / handle_auth_user_updated).
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (user_id, is_anonymous, contact_email)
  values (new.id, coalesce(new.is_anonymous, false), new.email)
  on conflict (user_id) do nothing;
  perform public.accept_pending_invites(new.email, new.id);
  return new;
end $$;

create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set is_anonymous  = coalesce(new.is_anonymous, false),
         contact_email = new.email
   where user_id = new.id;
  perform public.accept_pending_invites(new.email, new.id);
  return new;
end $$;

-- Verification
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='org_invites') as invites_table,
  (select count(*) from pg_proc where proname='accept_pending_invites') as accept_fn;
