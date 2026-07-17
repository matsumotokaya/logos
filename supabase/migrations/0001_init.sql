-- ============================================================================
-- logos — initial schema
-- Design: docs/account-design.md §7 (accounts/orgs/RLS)
--       + docs/data-model.md §6 (logo canonical record)
-- Idempotent: safe to re-run in the Supabase SQL editor.
--
-- Rules honored (CLAUDE.md):
--   * No foreign keys to auth.users — public.users is synced by trigger.
--   * RLS on every table; checks use auth.uid().
-- Pragmatic deviation from docs (recorded in docs/data-model.md §8):
--   * Master/variant SVGs are small text and stored inline (svg text),
--     not in Storage. Generated mockup images (large) go to Storage.
-- ============================================================================

-- ---------- users (mirror of auth.users) -----------------------------------
create table if not exists public.users (
  user_id       uuid primary key,          -- = auth.uid()
  display_name  text,
  contact_email text,
  is_anonymous  boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.users enable row level security;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (user_id, is_anonymous, contact_email)
  values (new.id, coalesce(new.is_anonymous, false), new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Anonymous → permanent upgrade keeps the same user_id; sync the flags.
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set is_anonymous  = coalesce(new.is_anonymous, false),
         contact_email = new.email
   where user_id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();

-- ---------- organizations / members / handles ------------------------------
create table if not exists public.organizations (
  org_id     uuid primary key default gen_random_uuid(),
  name       text not null,
  description text,
  website    text,
  industry   text,
  location   text,
  created_by uuid references public.users(user_id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

do $$ begin
  create type public.org_role as enum ('owner','admin','editor','purchaser','viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.org_members (
  org_id     uuid not null references public.organizations(org_id) on delete cascade,
  user_id    uuid not null references public.users(user_id) on delete cascade,
  role       public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.org_members enable row level security;

-- Shared vanity namespace for users AND orgs (layer-2 URLs, later phase).
create table if not exists public.handles (
  handle  text primary key check (handle ~ '^[a-z0-9](?:[a-z0-9-]{1,38})$'),
  user_id uuid unique references public.users(user_id) on delete cascade,
  org_id  uuid unique references public.organizations(org_id) on delete cascade,
  check (num_nonnulls(user_id, org_id) = 1)
);
alter table public.handles enable row level security;

create or replace function public.has_org_role(p_org_id uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select p_org_id is not null and exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;

-- ---------- logos (canonical record, layer A) -------------------------------
do $$ begin
  create type public.logo_visibility as enum ('draft','private','unlisted','public');
exception when duplicate_object then null; end $$;

create table if not exists public.logos (
  id             text primary key check (id ~ '^[A-Za-z0-9]{8,24}$'), -- nanoid, /p/[id]
  owner_user_id  uuid references public.users(user_id) on delete cascade,
  owner_org_id   uuid references public.organizations(org_id) on delete cascade,
  created_by     uuid references public.users(user_id) on delete set null, -- immutable credit
  title          text not null,
  role           text not null default 'other'
                 check (role in ('brand','corporate','service','subsidiary','other')),
  logo_type      text check (logo_type in ('symbol','logotype','combination','emblem')),
  parent_logo_id text references public.logos(id) on delete set null,
  visibility     public.logo_visibility not null default 'draft',
  allow_contact  boolean not null default false,
  slug           text,                     -- layer-2 vanity path (later phase)
  updated_by     uuid references public.users(user_id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (num_nonnulls(owner_user_id, owner_org_id) = 1)
);
alter table public.logos enable row level security;
create index if not exists logos_owner_user_idx on public.logos (owner_user_id);
create index if not exists logos_owner_org_idx on public.logos (owner_org_id);
create index if not exists logos_visibility_idx on public.logos (visibility);

create or replace function public.can_view_logo(p_logo_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.logos l
    where l.id = p_logo_id
      and (l.visibility in ('unlisted','public')
           or l.owner_user_id = auth.uid()
           or public.has_org_role(l.owner_org_id,
                array['owner','admin','editor','purchaser','viewer']::public.org_role[]))
  );
$$;

create or replace function public.can_edit_logo(p_logo_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.logos l
    where l.id = p_logo_id
      and (l.owner_user_id = auth.uid()
           or public.has_org_role(l.owner_org_id,
                array['owner','admin','editor']::public.org_role[]))
  );
$$;

create or replace function public.can_admin_logo(p_logo_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.logos l
    where l.id = p_logo_id
      and (l.owner_user_id = auth.uid()
           or public.has_org_role(l.owner_org_id,
                array['owner','admin']::public.org_role[]))
  );
$$;

-- ---------- candidates (A/B/C proposals; master SVG lives here) -------------
create table if not exists public.logo_candidates (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  label      text not null default 'A',
  is_primary boolean not null default false,
  svg        text not null,                -- master SVG (inline; R2 later)
  analysis   jsonb,                        -- color/path analysis (LogoData)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.logo_candidates enable row level security;
create unique index if not exists logo_candidates_primary_uq
  on public.logo_candidates (logo_id) where is_primary;

create table if not exists public.logo_variants (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.logo_candidates(id) on delete cascade,
  kind         text not null,              -- 'mono_black' | 'mono_white' | ...
  source       text not null default 'derived' check (source in ('derived','uploaded')),
  svg          text not null,
  created_at   timestamptz not null default now(),
  unique (candidate_id, kind)
);
alter table public.logo_variants enable row level security;

create table if not exists public.logo_mockups (
  candidate_id uuid not null references public.logo_candidates(id) on delete cascade,
  slot         text not null,              -- "mug" / "tote" / "cap" ...
  image_path   text not null,              -- Storage object path
  created_at   timestamptz not null default now(),
  primary key (candidate_id, slot)
);
alter table public.logo_mockups enable row level security;

create or replace function public.candidate_logo_id(p_candidate_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select logo_id from public.logo_candidates where id = p_candidate_id;
$$;

-- ---------- presentation (layer B) ------------------------------------------
create table if not exists public.logo_presentations (
  logo_id     text primary key references public.logos(id) on delete cascade,
  catchphrase text not null default '',
  story       text not null default '',
  scene_texts jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);
alter table public.logo_presentations enable row level security;

-- ---------- credits / trademarks / activities -------------------------------
create table if not exists public.logo_credits (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  role       text not null default 'designer'
             check (role in ('designer','studio','art_director','other')),
  name       text not null,
  user_id    uuid references public.users(user_id) on delete set null,
  contact    text not null default '',
  note       text,
  created_at timestamptz not null default now()
);
alter table public.logo_credits enable row level security;

create table if not exists public.logo_trademarks (
  id              uuid primary key default gen_random_uuid(),
  logo_id         text not null references public.logos(id) on delete cascade,
  status          text not null default 'unregistered'
                  check (status in ('registered','pending','unregistered')),
  jurisdiction    text not null default '',
  registration_no text not null default '',
  trademark_type  text check (trademark_type in ('word','device','combined','3d','other')),
  nice_classes    integer[] not null default '{}',
  goods_services  text not null default '',
  registered_at   date,
  expires_at      date,
  note            text,
  created_at      timestamptz not null default now()
);
alter table public.logo_trademarks enable row level security;

create table if not exists public.logo_activities (
  id         uuid primary key default gen_random_uuid(),
  logo_id    text not null references public.logos(id) on delete cascade,
  user_id    uuid references public.users(user_id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.logo_activities enable row level security;
create index if not exists logo_activities_logo_idx
  on public.logo_activities (logo_id, created_at desc);

-- ---------- discovery (layer C) ----------------------------------------------
create table if not exists public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique                -- normalized (lowercase, trimmed) by the app
);
alter table public.tags enable row level security;

create table if not exists public.logo_tags (
  logo_id text not null references public.logos(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (logo_id, tag_id)
);
alter table public.logo_tags enable row level security;

create table if not exists public.bookmarks (
  user_id    uuid not null references public.users(user_id) on delete cascade,
  logo_id    text not null references public.logos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, logo_id)
);
alter table public.bookmarks enable row level security;

-- ---------- inventory / orders (phase-3 merch, org-scoped) ------------------
create table if not exists public.inventory_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(org_id) on delete cascade,
  name            text not null,
  spec            text not null default '',
  category        text not null default '',
  emoji           text not null default '',
  unit            text not null default '',
  unit_price      integer not null default 0,
  stock           integer not null default 0,
  par_level       integer not null default 0,
  pending_qty     integer not null default 0,
  last_ordered_at timestamptz
);
alter table public.inventory_items enable row level security;

create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(org_id) on delete cascade,
  item_id    uuid not null references public.inventory_items(id),
  item_name  text not null,
  qty        integer not null check (qty > 0),
  amount     integer not null,
  status     text not null default 'ordered' check (status in ('ordered','delivered')),
  ordered_by uuid references public.users(user_id) on delete set null,
  ordered_at timestamptz not null default now()
);
alter table public.orders enable row level security;

-- ============================================================================
-- RLS policies
-- ============================================================================

-- users: everyone can read display profiles; only the owner writes.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (true);
drop policy if exists users_update on public.users;
create policy users_update on public.users for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- organizations: members read; owner updates; any authenticated user creates.
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations for select
  using (has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[]));
drop policy if exists orgs_insert on public.organizations;
create policy orgs_insert on public.organizations for insert
  to authenticated with check (created_by = auth.uid());
drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations for update
  using (has_org_role(org_id, array['owner']::public.org_role[]));

-- org_members: members see the roster; owner/admin manage it.
drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members for select
  using (has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[]));
drop policy if exists org_members_write on public.org_members;
create policy org_members_write on public.org_members for all
  using (has_org_role(org_id, array['owner','admin']::public.org_role[]))
  with check (has_org_role(org_id, array['owner','admin']::public.org_role[]));

-- handles: public read (they resolve URLs); owners manage their own.
drop policy if exists handles_select on public.handles;
create policy handles_select on public.handles for select using (true);
drop policy if exists handles_write on public.handles;
create policy handles_write on public.handles for all
  using (user_id = auth.uid() or has_org_role(org_id, array['owner','admin']::public.org_role[]))
  with check (user_id = auth.uid() or has_org_role(org_id, array['owner','admin']::public.org_role[]));

-- logos
drop policy if exists logos_select on public.logos;
create policy logos_select on public.logos for select using (
  visibility in ('unlisted','public')
  or owner_user_id = auth.uid()
  or has_org_role(owner_org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[])
);
drop policy if exists logos_insert on public.logos;
create policy logos_insert on public.logos for insert to authenticated with check (
  created_by = auth.uid()
  and (owner_user_id = auth.uid()
       or has_org_role(owner_org_id, array['owner','admin','editor']::public.org_role[]))
);
drop policy if exists logos_update on public.logos;
create policy logos_update on public.logos for update
  using (can_edit_logo(id));
  -- NOTE: visibility changes being admin-only is enforced server-side by the
  -- trigger in 0011_visibility_admin_enforcement.sql (RLS is row-level only).
drop policy if exists logos_delete on public.logos;
create policy logos_delete on public.logos for delete using (can_admin_logo(id));

-- children of logos: view follows the logo, writes follow edit rights.
drop policy if exists candidates_select on public.logo_candidates;
create policy candidates_select on public.logo_candidates for select using (can_view_logo(logo_id));
drop policy if exists candidates_write on public.logo_candidates;
create policy candidates_write on public.logo_candidates for all
  using (can_edit_logo(logo_id)) with check (can_edit_logo(logo_id));

drop policy if exists variants_select on public.logo_variants;
create policy variants_select on public.logo_variants for select
  using (can_view_logo(candidate_logo_id(candidate_id)));
drop policy if exists variants_write on public.logo_variants;
create policy variants_write on public.logo_variants for all
  using (can_edit_logo(candidate_logo_id(candidate_id)))
  with check (can_edit_logo(candidate_logo_id(candidate_id)));

drop policy if exists mockups_select on public.logo_mockups;
create policy mockups_select on public.logo_mockups for select
  using (can_view_logo(candidate_logo_id(candidate_id)));
drop policy if exists mockups_write on public.logo_mockups;
create policy mockups_write on public.logo_mockups for all
  using (can_edit_logo(candidate_logo_id(candidate_id)))
  with check (can_edit_logo(candidate_logo_id(candidate_id)));

drop policy if exists presentations_select on public.logo_presentations;
create policy presentations_select on public.logo_presentations for select using (can_view_logo(logo_id));
drop policy if exists presentations_write on public.logo_presentations;
create policy presentations_write on public.logo_presentations for all
  using (can_edit_logo(logo_id)) with check (can_edit_logo(logo_id));

drop policy if exists credits_select on public.logo_credits;
create policy credits_select on public.logo_credits for select using (can_view_logo(logo_id));
drop policy if exists credits_write on public.logo_credits;
create policy credits_write on public.logo_credits for all
  using (can_edit_logo(logo_id)) with check (can_edit_logo(logo_id));

drop policy if exists trademarks_select on public.logo_trademarks;
create policy trademarks_select on public.logo_trademarks for select using (can_view_logo(logo_id));
drop policy if exists trademarks_write on public.logo_trademarks;
create policy trademarks_write on public.logo_trademarks for all
  using (can_edit_logo(logo_id)) with check (can_edit_logo(logo_id));

-- activities: append-only, visible to people who can edit the logo.
drop policy if exists activities_select on public.logo_activities;
create policy activities_select on public.logo_activities for select using (can_edit_logo(logo_id));
drop policy if exists activities_insert on public.logo_activities;
create policy activities_insert on public.logo_activities for insert
  with check (can_edit_logo(logo_id));
-- no update/delete policies: rows are immutable under RLS.

-- tags: readable by all; created by any signed-in user; assignment needs edit rights.
drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags for select using (true);
drop policy if exists tags_insert on public.tags;
create policy tags_insert on public.tags for insert to authenticated with check (true);

drop policy if exists logo_tags_select on public.logo_tags;
create policy logo_tags_select on public.logo_tags for select using (can_view_logo(logo_id));
drop policy if exists logo_tags_write on public.logo_tags;
create policy logo_tags_write on public.logo_tags for all
  using (can_edit_logo(logo_id)) with check (can_edit_logo(logo_id));

-- bookmarks: strictly personal; target must be viewable when created.
drop policy if exists bookmarks_select on public.bookmarks;
create policy bookmarks_select on public.bookmarks for select using (user_id = auth.uid());
drop policy if exists bookmarks_insert on public.bookmarks;
create policy bookmarks_insert on public.bookmarks for insert
  with check (user_id = auth.uid() and can_view_logo(logo_id));
drop policy if exists bookmarks_delete on public.bookmarks;
create policy bookmarks_delete on public.bookmarks for delete using (user_id = auth.uid());

-- inventory / orders: org members read; owner/admin/purchaser operate.
drop policy if exists inventory_select on public.inventory_items;
create policy inventory_select on public.inventory_items for select
  using (has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[]));
drop policy if exists inventory_write on public.inventory_items;
create policy inventory_write on public.inventory_items for all
  using (has_org_role(org_id, array['owner','admin','purchaser']::public.org_role[]))
  with check (has_org_role(org_id, array['owner','admin','purchaser']::public.org_role[]));

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select
  using (has_org_role(org_id, array['owner','admin','editor','purchaser','viewer']::public.org_role[]));
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert
  with check (ordered_by = auth.uid()
              and has_org_role(org_id, array['owner','admin','purchaser']::public.org_role[]));

-- ---------- storage: generated mockup images --------------------------------
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', true)
on conflict (id) do nothing;

drop policy if exists "mockups public read" on storage.objects;
create policy "mockups public read" on storage.objects for select
  using (bucket_id = 'mockups');
drop policy if exists "mockups authenticated write" on storage.objects;
create policy "mockups authenticated write" on storage.objects for insert
  to authenticated with check (bucket_id = 'mockups');

-- ============================================================================
-- Verification: list what exists now (paste this output back).
-- ============================================================================
select table_name,
       (select count(*) from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t.table_name) as column_count
from information_schema.tables t
where table_schema = 'public'
order by table_name;
