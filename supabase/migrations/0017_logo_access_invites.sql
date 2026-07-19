-- 0017_logo_access_invites.sql
-- Pending email invitations for logo-scoped collaboration. A direct grant
-- still points only at a registered user or organization; this table carries
-- the pre-registration state without exposing the user directory to clients.

create table if not exists public.logo_access_invites (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  email      text not null,
  role       public.logo_access_role not null default 'viewer',
  invited_by uuid references public.users(user_id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email)) and position('@' in email) > 1),
  check (expires_at > created_at)
);

alter table public.logo_access_invites enable row level security;

create unique index if not exists logo_access_invites_logo_email_uq
  on public.logo_access_invites (logo_id, lower(email));
create index if not exists logo_access_invites_email_expiry_idx
  on public.logo_access_invites (lower(email), expires_at);

revoke all on public.logo_access_invites from public, anon;
grant select, insert, delete on public.logo_access_invites to authenticated;
grant update (role, expires_at, updated_at)
  on public.logo_access_invites to authenticated;

drop policy if exists logo_access_invites_select
  on public.logo_access_invites;
create policy logo_access_invites_select
  on public.logo_access_invites
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists logo_access_invites_insert
  on public.logo_access_invites;
create policy logo_access_invites_insert
  on public.logo_access_invites
  for insert to authenticated
  with check (
    private.is_registered_user()
    and invited_by = auth.uid()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists logo_access_invites_update
  on public.logo_access_invites;
create policy logo_access_invites_update
  on public.logo_access_invites
  for update to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  )
  with check (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  );

drop policy if exists logo_access_invites_delete
  on public.logo_access_invites;
create policy logo_access_invites_delete
  on public.logo_access_invites
  for delete to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_logo(logo_id)
  );

create or replace function private.accept_pending_logo_access_invites(
  p_email text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or btrim(p_email) = '' or not exists (
    select 1
    from public.users
    where user_id = p_user_id and not is_anonymous
  ) then
    return;
  end if;

  insert into public.logo_access_grants (
    logo_id,
    grantee_user_id,
    role,
    granted_by
  )
  select
    i.logo_id,
    p_user_id,
    i.role,
    i.invited_by
  from public.logo_access_invites i
  where lower(i.email) = lower(btrim(p_email))
    and i.expires_at > now()
  on conflict (logo_id, grantee_user_id)
    where grantee_user_id is not null
  do update set
    role = excluded.role,
    granted_by = excluded.granted_by,
    updated_at = now();

  -- Accepted and expired invitations for this identity are both terminal.
  delete from public.logo_access_invites
  where lower(email) = lower(btrim(p_email));
end;
$$;

create or replace function private.resolve_existing_logo_access_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  select user_id into target_user_id
  from public.users
  where lower(contact_email) = lower(new.email)
    and not is_anonymous
  order by created_at
  limit 1;

  if target_user_id is not null then
    perform private.accept_pending_logo_access_invites(
      new.email,
      target_user_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_logo_access_invite_resolve_existing
  on public.logo_access_invites;
create trigger on_logo_access_invite_resolve_existing
  after insert on public.logo_access_invites
  for each row execute function private.resolve_existing_logo_access_invite();

-- Extend the existing auth mirror hooks so an invitation is accepted after
-- email confirmation or OAuth upgrades the anonymous session in place.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (user_id, is_anonymous, contact_email)
  values (new.id, coalesce(new.is_anonymous, false), new.email)
  on conflict (user_id) do nothing;
  perform private.accept_pending_invites(new.email, new.id);
  perform private.accept_pending_logo_access_invites(new.email, new.id);
  return new;
end;
$$;

create or replace function private.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set is_anonymous = coalesce(new.is_anonymous, false),
      contact_email = new.email
  where user_id = new.id;
  perform private.accept_pending_invites(new.email, new.id);
  perform private.accept_pending_logo_access_invites(new.email, new.id);
  return new;
end;
$$;

revoke all on function private.accept_pending_logo_access_invites(text, uuid)
  from public, anon, authenticated;
revoke all on function private.resolve_existing_logo_access_invite()
  from public, anon, authenticated;
