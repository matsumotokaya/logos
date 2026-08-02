-- ============================================================================
-- 0019 - brand hierarchy and campaign catalog
--
-- Keep public.organizations as the access-management workspace. The real-world
-- brand hierarchy lives in brand_entities:
--
--   organization (company / sole proprietor)
--     -> business (service / product / business unit)
--       -> audience (personal / business / enterprise variant)
--
-- Every node may own a brand profile and logo assets. A campaign always points
-- at one node and may select a logo from that node or an ancestor.
-- ============================================================================

-- ---------- real-world organization / business hierarchy -------------------

alter table public.brand_entities
  drop constraint if exists brand_entities_entity_type_check;

update public.brand_entities
set entity_type = case
  when entity_type = 'company' then 'organization'
  when entity_type in ('brand', 'product', 'service', 'other') then 'business'
  else entity_type
end;

alter table public.brand_entities
  add constraint brand_entities_entity_type_check
  check (entity_type in ('organization', 'business', 'audience'));

alter table public.brand_entities
  add column if not exists organization_kind text,
  add column if not exists status text not null default 'inferred',
  add column if not exists source_kind text not null default 'manual',
  add column if not exists provenance jsonb not null default '{}'::jsonb;

alter table public.brand_entities
  drop constraint if exists brand_entities_organization_kind_check,
  add constraint brand_entities_organization_kind_check
    check (
      organization_kind is null
      or (
        entity_type = 'organization'
        and organization_kind in ('company', 'individual', 'nonprofit', 'other')
      )
    ),
  drop constraint if exists brand_entities_status_check,
  add constraint brand_entities_status_check
    check (status in ('inferred', 'confirmed', 'archived')),
  drop constraint if exists brand_entities_source_kind_check,
  add constraint brand_entities_source_kind_check
    check (source_kind in ('manual', 'scraped', 'uploaded', 'generated', 'imported')),
  drop constraint if exists brand_entities_hierarchy_check,
  add constraint brand_entities_hierarchy_check
    check (
      (entity_type = 'organization' and parent_entity_id is null)
      or (entity_type in ('business', 'audience') and parent_entity_id is not null)
    );

create index if not exists brand_entities_type_parent_idx
  on public.brand_entities (entity_type, parent_entity_id, created_at);
create index if not exists brand_entities_website_idx
  on public.brand_entities (website) where website <> '';

create or replace function public.enforce_brand_entity_hierarchy()
returns trigger language plpgsql set search_path = public as $$
declare
  parent_type text;
begin
  if new.entity_type = 'organization' then
    if new.parent_entity_id is not null then
      raise exception 'An organization cannot have a parent brand entity.';
    end if;
    return new;
  end if;

  select entity_type into parent_type
  from public.brand_entities
  where id = new.parent_entity_id;

  if new.entity_type = 'business' and parent_type <> 'organization' then
    raise exception 'A business must belong to an organization.';
  end if;
  if new.entity_type = 'audience' and parent_type <> 'business' then
    raise exception 'An audience brand must belong to a business.';
  end if;
  return new;
end $$;

drop trigger if exists brand_entities_enforce_hierarchy on public.brand_entities;
create trigger brand_entities_enforce_hierarchy
  before insert or update of entity_type, parent_entity_id
  on public.brand_entities
  for each row execute function public.enforce_brand_entity_hierarchy();

-- The 0008 policy only checked who created the new row. A child must also be
-- attached to a parent the caller may manage, otherwise a guessed UUID could
-- cross brand boundaries.
drop policy if exists brand_entities_insert on public.brand_entities;
create policy brand_entities_insert on public.brand_entities
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      linked_org_id is null
      or private.has_org_role(
        linked_org_id,
        array['owner','admin']::public.org_role[]
      )
    )
    and (
      (entity_type = 'organization' and parent_entity_id is null)
      or private.can_manage_brand_entity(parent_entity_id)
    )
  );

drop policy if exists brand_entities_update on public.brand_entities;
create policy brand_entities_update on public.brand_entities
  for update using (private.can_manage_brand_entity(id))
  with check (
    private.can_manage_brand_entity(id)
    and (
      (entity_type = 'organization' and parent_entity_id is null)
      or private.can_manage_brand_entity(parent_entity_id)
    )
  );

comment on table public.brand_entities is
  'Real-world brand hierarchy. organization is the largest corporate/person box; business is a service/product; audience is a branded market variant.';
comment on column public.brand_entities.linked_org_id is
  'Optional access-management workspace. This is not the real-world organization represented by the row.';
comment on column public.brand_entities.provenance is
  'Field-level source, confidence, and confirmation metadata for inferred or imported facts.';

-- ---------- inheritable profile per hierarchy node --------------------------

create table if not exists public.brand_profiles (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid not null unique references public.brand_entities(id) on delete cascade,
  inherits_parent  boolean not null default true,
  status           text not null default 'inferred'
                   check (status in ('inferred', 'confirmed', 'archived')),
  profile          jsonb not null default '{}'::jsonb,
  provenance       jsonb not null default '{}'::jsonb,
  created_by       uuid references public.users(user_id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.brand_profiles enable row level security;

create index if not exists brand_profiles_status_idx
  on public.brand_profiles (status, updated_at desc);

drop policy if exists brand_profiles_select on public.brand_profiles;
create policy brand_profiles_select on public.brand_profiles
  for select using (private.can_view_brand_entity(entity_id));

drop policy if exists brand_profiles_insert on public.brand_profiles;
create policy brand_profiles_insert on public.brand_profiles
  for insert to authenticated with check (
    created_by = auth.uid() and private.can_manage_brand_entity(entity_id)
  );

drop policy if exists brand_profiles_update on public.brand_profiles;
create policy brand_profiles_update on public.brand_profiles
  for update using (private.can_manage_brand_entity(entity_id))
  with check (private.can_manage_brand_entity(entity_id));

drop policy if exists brand_profiles_delete on public.brand_profiles;
create policy brand_profiles_delete on public.brand_profiles
  for delete using (private.can_manage_brand_entity(entity_id));

comment on table public.brand_profiles is
  'Current brand rules for one hierarchy node. Missing fields inherit from the parent when inherits_parent=true.';
comment on column public.brand_profiles.profile is
  'Stable brand facts and rules: palette, typography, tone, design tokens, audience, and offering.';
comment on column public.brand_profiles.provenance is
  'Field-level source/confidence metadata. User-confirmed values take precedence over inferred values.';

-- ---------- provisional raster logo support --------------------------------

alter table public.logo_candidates
  alter column svg drop not null,
  add column if not exists media_type text not null default 'image/svg+xml',
  add column if not exists file_path text,
  add column if not exists source_url text,
  add column if not exists asset_status text not null default 'official',
  add column if not exists provenance jsonb not null default '{}'::jsonb;

alter table public.logo_candidates
  drop constraint if exists logo_candidates_media_type_check,
  add constraint logo_candidates_media_type_check
    check (media_type in ('image/svg+xml', 'image/png', 'image/jpeg', 'image/webp')),
  drop constraint if exists logo_candidates_asset_status_check,
  add constraint logo_candidates_asset_status_check
    check (asset_status in ('provisional', 'official', 'generated')),
  drop constraint if exists logo_candidates_file_check,
  add constraint logo_candidates_file_check
    check (svg is not null or file_path is not null);

comment on column public.logo_candidates.asset_status is
  'provisional for a scraped or low-resolution logo, official after owner confirmation, generated for a proposed replacement.';
comment on column public.logo_candidates.file_path is
  'R2 object key for raster or externally stored vector masters. Inline SVG remains supported by svg.';

-- ---------- campaigns and generated outputs --------------------------------

create table if not exists public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  brand_entity_id    uuid not null references public.brand_entities(id) on delete restrict,
  logo_id            text references public.logos(id) on delete set null,
  name               text not null,
  status             text not null default 'draft'
                     check (status in ('running', 'draft', 'published', 'failed', 'archived')),
  visibility         text not null default 'private'
                     check (visibility in ('private', 'unlisted', 'public')),
  source_url         text,
  brand_kit          jsonb not null default '{}'::jsonb,
  public_slug        text,
  created_by         uuid references public.users(user_id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz
);
alter table public.campaigns enable row level security;

create unique index if not exists campaigns_public_slug_uq
  on public.campaigns (public_slug) where public_slug is not null;
create index if not exists campaigns_entity_created_idx
  on public.campaigns (brand_entity_id, created_at desc);
create index if not exists campaigns_logo_idx
  on public.campaigns (logo_id) where logo_id is not null;

create or replace function public.brand_entity_is_ancestor(
  p_ancestor_id uuid,
  p_descendant_id uuid
)
returns boolean language sql stable set search_path = public as $$
  with recursive lineage as (
    select id, parent_entity_id
    from public.brand_entities
    where id = p_descendant_id
    union all
    select parent.id, parent.parent_entity_id
    from public.brand_entities parent
    join lineage child on child.parent_entity_id = parent.id
  )
  select exists (select 1 from lineage where id = p_ancestor_id);
$$;

create or replace function public.enforce_campaign_brand_boundary()
returns trigger language plpgsql set search_path = public as $$
declare
  campaign_entity_type text;
  logo_entity_id uuid;
begin
  select entity_type into campaign_entity_type
  from public.brand_entities
  where id = new.brand_entity_id;

  if campaign_entity_type not in ('business', 'audience') then
    raise exception 'A campaign must belong to a business or audience brand.';
  end if;

  if new.logo_id is null then
    return new;
  end if;

  select subject_entity_id into logo_entity_id
  from public.logos
  where id = new.logo_id;

  if logo_entity_id is null
     or not public.brand_entity_is_ancestor(logo_entity_id, new.brand_entity_id) then
    raise exception 'Campaign logo must belong to the campaign brand or one of its ancestors.';
  end if;
  return new;
end $$;

drop trigger if exists campaigns_enforce_brand_boundary on public.campaigns;
create trigger campaigns_enforce_brand_boundary
  before insert or update of brand_entity_id, logo_id
  on public.campaigns
  for each row execute function public.enforce_campaign_brand_boundary();

create or replace function public.can_view_campaign(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and (
        c.visibility in ('unlisted', 'public')
        or private.can_view_brand_entity(c.brand_entity_id)
      )
  );
$$;

create or replace function public.can_manage_campaign(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and private.can_manage_brand_entity(c.brand_entity_id)
  );
$$;

drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns
  for select using (public.can_view_campaign(id));

drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns
  for insert to authenticated with check (
    created_by = auth.uid() and private.can_manage_brand_entity(brand_entity_id)
  );

drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns
  for update using (public.can_manage_campaign(id))
  with check (private.can_manage_brand_entity(brand_entity_id));

drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns
  for delete using (public.can_manage_campaign(id));

create table if not exists public.campaign_sources (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  source_type   text not null check (source_type in ('url', 'pdf', 'image', 'text')),
  source_url    text,
  storage_path  text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
alter table public.campaign_sources enable row level security;
create index if not exists campaign_sources_campaign_idx
  on public.campaign_sources (campaign_id, created_at);

drop policy if exists campaign_sources_select on public.campaign_sources;
create policy campaign_sources_select on public.campaign_sources
  for select using (public.can_view_campaign(campaign_id));
drop policy if exists campaign_sources_write on public.campaign_sources;
create policy campaign_sources_write on public.campaign_sources
  for all using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

create table if not exists public.campaign_runs (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  external_job_id  uuid unique,
  status           text not null default 'running'
                   check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  steps            jsonb not null default '[]'::jsonb,
  usage            jsonb not null default '{}'::jsonb,
  error_message    text,
  triggered_by     uuid references public.users(user_id) on delete set null,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.campaign_runs enable row level security;
create index if not exists campaign_runs_campaign_idx
  on public.campaign_runs (campaign_id, created_at desc);

drop policy if exists campaign_runs_select on public.campaign_runs;
create policy campaign_runs_select on public.campaign_runs
  for select using (public.can_view_campaign(campaign_id));
drop policy if exists campaign_runs_write on public.campaign_runs;
create policy campaign_runs_write on public.campaign_runs
  for all using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

create table if not exists public.campaign_artifacts (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  run_id        uuid references public.campaign_runs(id) on delete set null,
  artifact_type text not null
                check (artifact_type in ('lp', 'narration', 'audio', 'video', 'banner', 'mockup')),
  status        text not null default 'ready'
                check (status in ('pending', 'ready', 'failed', 'archived')),
  storage_path  text,
  public_path   text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.campaign_artifacts enable row level security;
create index if not exists campaign_artifacts_campaign_idx
  on public.campaign_artifacts (campaign_id, artifact_type, created_at desc);

drop policy if exists campaign_artifacts_select on public.campaign_artifacts;
create policy campaign_artifacts_select on public.campaign_artifacts
  for select using (public.can_view_campaign(campaign_id));
drop policy if exists campaign_artifacts_write on public.campaign_artifacts;
create policy campaign_artifacts_write on public.campaign_artifacts
  for all using (public.can_manage_campaign(campaign_id))
  with check (public.can_manage_campaign(campaign_id));

comment on table public.campaigns is
  'Campaigns are outputs under one business/audience node. brand_kit is the immutable generation-time snapshot.';
comment on column public.campaigns.logo_id is
  'Selected logo. The application allows a logo attached to the campaign node or one of its ancestors.';
comment on table public.campaign_sources is
  'User-provided and scraped inputs. Source URLs are distinct from the generated campaign public URL.';
comment on table public.campaign_artifacts is
  'LP, narration, audio, video, banner, and mockup outputs produced by campaign runs.';

-- ---------- migration contract checks --------------------------------------

select
  to_regclass('public.brand_profiles') is not null as has_brand_profiles,
  to_regclass('public.campaigns') is not null as has_campaigns,
  to_regclass('public.campaign_sources') is not null as has_campaign_sources,
  to_regclass('public.campaign_runs') is not null as has_campaign_runs,
  to_regclass('public.campaign_artifacts') is not null as has_campaign_artifacts;
