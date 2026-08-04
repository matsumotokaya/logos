-- ============================================================================
-- 0030 - Publication (a surface, a state, a history) and canonical slots
--
-- Design: docs/schema-v2.md §12 §14.1
--
-- Publishing is not a boolean on the output. The same render can be live on a
-- share URL, a vanity URL, an embed and a custom domain, each with its own
-- state and history. The current video metadata carries a `published` flag that
-- does nothing when pressed; this table is what it becomes.
--
-- Two rules:
--   * the target is a RENDER (what actually goes public is a locale/ratio)
--   * only the admin rung may publish. Editors can build, not release.
--
-- canonical_slots answers "which take is THE one" for a small, registry-owned
-- set of names — not per tool kind. Which LP is the main one is answered by
-- publications, not here.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.publications (
  id            uuid primary key default gen_random_uuid(),
  render_id     uuid not null references public.take_renders(id) on delete restrict,
  surface       text not null check (surface in
                  ('canonical_url','vanity_url','embed','social','custom_domain')),
  url_path      text,
  status        text not null default 'draft' check (status in
                  ('draft','live','rolled_back','retired')),
  supersedes_id uuid references public.publications(id) on delete set null,
  published_at  timestamptz,
  published_by  uuid references public.users(user_id) on delete set null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'live' or published_at is not null),
  check (supersedes_id is null or supersedes_id <> id)
);
alter table public.publications enable row level security;

-- One live occupant per address. Rolling back means the old row goes to
-- 'rolled_back' and a new row takes the path, so the history stays readable.
create unique index if not exists publications_live_path_uq
  on public.publications (surface, url_path)
  where status = 'live' and url_path is not null;
create index if not exists publications_render_idx
  on public.publications (render_id, created_at desc);
create index if not exists publications_status_idx
  on public.publications (status, surface);

comment on table public.publications is
  'Where a render is published, in what state, and what it replaced. status=live is the ONLY source of truth for "is this public".';
comment on column public.publications.render_id is
  'ON DELETE RESTRICT: a published output cannot be deleted out from under its URL. Retire the publication first.';

create table if not exists public.canonical_slots (
  id         uuid primary key default gen_random_uuid(),
  slot       text not null check (slot in
               ('logo_presentation','brand_guide','default_product_video')),
  brand_id   uuid references public.brand_entities(id) on delete cascade,
  logo_id    text references public.logos(id) on delete cascade,
  take_id    uuid not null references public.takes(id) on delete restrict,
  updated_by uuid references public.users(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  check (num_nonnulls(brand_id, logo_id) = 1),
  -- The logo presentation resolves from a logo id because /p/[id] is a logo
  -- URL; the other slots belong to a Brand.
  check (
    (slot = 'logo_presentation' and logo_id is not null)
    or (slot <> 'logo_presentation' and brand_id is not null)
  )
);
alter table public.canonical_slots enable row level security;

create unique index if not exists canonical_slots_brand_uq
  on public.canonical_slots (brand_id, slot) where brand_id is not null;
create unique index if not exists canonical_slots_logo_uq
  on public.canonical_slots (logo_id, slot) where logo_id is not null;
create index if not exists canonical_slots_take_idx
  on public.canonical_slots (take_id);

comment on table public.canonical_slots is
  'Named slots a registry declares (logo presentation, official brand guide, default product video). Not a default per tool kind.';
comment on column public.canonical_slots.take_id is
  'ON DELETE RESTRICT so /p/[id] can never resolve to a deleted take.';

-- ---------- policies --------------------------------------------------------

drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_brand_entity(private.render_brand_id(render_id))
  );

-- Publishing, unpublishing and rolling back all live here, all at the admin
-- rung. A brand grant never reaches it.
drop policy if exists publications_insert on public.publications;
create policy publications_insert on public.publications
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_admin_brand(private.render_brand_id(render_id))
    and (published_by is null or published_by = auth.uid())
  );

drop policy if exists publications_update on public.publications;
create policy publications_update on public.publications
  for update to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_brand(private.render_brand_id(render_id))
  )
  with check (
    private.is_registered_user()
    and private.can_admin_brand(private.render_brand_id(render_id))
  );

drop policy if exists publications_delete on public.publications;
create policy publications_delete on public.publications
  for delete to authenticated
  using (
    private.is_registered_user()
    and private.can_admin_brand(private.render_brand_id(render_id))
  );

drop policy if exists canonical_slots_select on public.canonical_slots;
create policy canonical_slots_select on public.canonical_slots
  for select to authenticated
  using (
    private.is_registered_user()
    and (
      (brand_id is not null and private.can_view_brand_entity(brand_id))
      or (logo_id is not null and private.can_view_logo(logo_id))
    )
  );

drop policy if exists canonical_slots_write on public.canonical_slots;
create policy canonical_slots_write on public.canonical_slots
  for all to authenticated
  using (
    private.is_registered_user()
    and (
      (brand_id is not null and private.can_edit_brand_core(brand_id))
      or (logo_id is not null and private.can_admin_logo(logo_id))
    )
  )
  with check (
    private.is_registered_user()
    and (
      (brand_id is not null and private.can_edit_brand_core(brand_id))
      or (logo_id is not null and private.can_admin_logo(logo_id))
    )
  );

-- ---------- verification ---------------------------------------------------

select
  to_regclass('public.publications') is not null as has_publications,
  to_regclass('public.canonical_slots') is not null as has_canonical_slots,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'publications_live_path_uq'
  ) as one_live_row_per_address,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'publications' and 'anon' = any(roles)
  ) as publications_closed_to_anon;
