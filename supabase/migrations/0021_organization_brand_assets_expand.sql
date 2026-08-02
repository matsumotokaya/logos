-- ============================================================================
-- 0021 - expand to Organization -> Brand -> Assets
--
-- This is the non-destructive expand phase. Existing brand_entities rows and
-- campaign tables remain available while the application switches to:
--
--   brand_organizations (container only)
--     -> brand_entities (corporate / business / audience brands)
--       -> brand_profiles / logos / brand_generation_runs / brand_assets
--
-- A later contract migration may remove legacy Organization rows from
-- brand_entities and retire the campaign tables after every reader has moved.
-- ============================================================================

-- ---------- real-world Organization containers -----------------------------

create table if not exists public.brand_organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  organization_kind text check (
    organization_kind is null
    or organization_kind in ('company', 'individual', 'nonprofit', 'other')
  ),
  linked_org_id     uuid references public.organizations(org_id) on delete set null,
  website           text not null default '',
  industry          text not null default '',
  location          text not null default '',
  description       text not null default '',
  status            text not null default 'inferred'
                    check (status in ('inferred', 'confirmed', 'archived')),
  source_kind       text not null default 'manual'
                    check (source_kind in ('manual', 'scraped', 'uploaded', 'generated', 'imported')),
  provenance        jsonb not null default '{}'::jsonb,
  created_by        uuid references public.users(user_id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.brand_organizations enable row level security;

create index if not exists brand_organizations_linked_org_idx
  on public.brand_organizations (linked_org_id);
create index if not exists brand_organizations_created_by_idx
  on public.brand_organizations (created_by);
create index if not exists brand_organizations_status_idx
  on public.brand_organizations (status, updated_at desc);

-- Keep the existing Organization UUIDs stable when copying them into the new
-- container table. This preserves bookmarks and makes redirects deterministic.
insert into public.brand_organizations (
  id,
  name,
  organization_kind,
  linked_org_id,
  website,
  industry,
  location,
  description,
  status,
  source_kind,
  provenance,
  created_by,
  created_at,
  updated_at
)
select
  entity.id,
  entity.name,
  entity.organization_kind,
  entity.linked_org_id,
  entity.website,
  entity.industry,
  entity.location,
  entity.description,
  entity.status,
  entity.source_kind,
  entity.provenance || jsonb_build_object(
    'migrated_from', 'brand_entities.organization'
  ),
  entity.created_by,
  entity.created_at,
  entity.updated_at
from public.brand_entities entity
where entity.entity_type = 'organization'
on conflict (id) do nothing;

-- ---------- make every market-facing subject a Brand -----------------------

alter table public.brand_entities
  add column if not exists brand_organization_id uuid
    references public.brand_organizations(id) on delete restrict,
  add column if not exists brand_kind text,
  add column if not exists parent_brand_id uuid
    references public.brand_entities(id) on delete set null,
  add column if not exists is_primary_brand boolean not null default false;

alter table public.brand_entities
  drop constraint if exists brand_entities_entity_type_check,
  add constraint brand_entities_entity_type_check
    check (entity_type in ('organization', 'business', 'audience', 'brand')),
  drop constraint if exists brand_entities_hierarchy_check,
  add constraint brand_entities_hierarchy_check
    check (
      (entity_type = 'organization' and parent_entity_id is null and brand_kind is null)
      or (entity_type in ('business', 'audience') and parent_entity_id is not null)
      or (entity_type = 'brand' and brand_kind is not null)
    ),
  drop constraint if exists brand_entities_brand_kind_check,
  add constraint brand_entities_brand_kind_check
    check (
      brand_kind is null
      or brand_kind in ('corporate', 'business', 'audience')
    ),
  drop constraint if exists brand_entities_primary_brand_check,
  add constraint brand_entities_primary_brand_check
    check (not is_primary_brand or brand_kind = 'corporate');

create index if not exists brand_entities_organization_kind_idx
  on public.brand_entities (brand_organization_id, brand_kind, created_at);
create index if not exists brand_entities_parent_brand_idx
  on public.brand_entities (parent_brand_id);
create unique index if not exists brand_entities_primary_corporate_uq
  on public.brand_entities (brand_organization_id)
  where brand_kind = 'corporate' and is_primary_brand;

-- Every Organization receives one primary corporate Brand. Corporate-facing
-- fields are copied as an initial inferred snapshot; future edits are separate
-- from legal/container facts kept on brand_organizations.
insert into public.brand_entities (
  name,
  entity_type,
  parent_entity_id,
  linked_org_id,
  website,
  industry,
  location,
  description,
  status,
  source_kind,
  provenance,
  created_by,
  created_at,
  updated_at,
  brand_organization_id,
  brand_kind,
  parent_brand_id,
  is_primary_brand
)
select
  organization.name,
  'brand',
  organization.id,
  organization.linked_org_id,
  organization.website,
  organization.industry,
  organization.location,
  organization.description,
  organization.status,
  organization.source_kind,
  organization.provenance || jsonb_build_object(
    'system_key', 'primary_corporate_brand',
    'migrated_from_organization_id', organization.id
  ),
  organization.created_by,
  organization.created_at,
  organization.updated_at,
  organization.id,
  'corporate',
  null,
  true
from public.brand_organizations organization
where not exists (
  select 1
  from public.brand_entities brand
  where brand.brand_organization_id = organization.id
    and brand.brand_kind = 'corporate'
    and brand.is_primary_brand
);

-- Existing business and audience rows keep their UUIDs. Their old
-- parent_entity_id remains during the expand phase for compatibility; the new
-- parent_brand_id is the canonical inheritance edge.
update public.brand_entities business
set
  brand_organization_id = business.parent_entity_id,
  brand_kind = 'business',
  parent_brand_id = corporate.id
from public.brand_entities corporate
where business.entity_type = 'business'
  and business.brand_organization_id is null
  and corporate.brand_organization_id = business.parent_entity_id
  and corporate.brand_kind = 'corporate'
  and corporate.is_primary_brand;

update public.brand_entities audience
set
  brand_organization_id = business.brand_organization_id,
  brand_kind = 'audience',
  parent_brand_id = business.id
from public.brand_entities business
where audience.entity_type = 'audience'
  and audience.brand_organization_id is null
  and audience.parent_entity_id = business.id
  and business.brand_kind = 'business';

-- Organization-level marketing data now belongs to the corporate Brand.
update public.brand_profiles profile
set entity_id = corporate.id,
    updated_at = now()
from public.brand_entities legacy_organization
join public.brand_entities corporate
  on corporate.brand_organization_id = legacy_organization.id
 and corporate.brand_kind = 'corporate'
 and corporate.is_primary_brand
where legacy_organization.entity_type = 'organization'
  and profile.entity_id = legacy_organization.id
  and not exists (
    select 1 from public.brand_profiles existing
    where existing.entity_id = corporate.id
  );

update public.logos logo
set subject_entity_id = corporate.id,
    updated_at = now()
from public.brand_entities legacy_organization
join public.brand_entities corporate
  on corporate.brand_organization_id = legacy_organization.id
 and corporate.brand_kind = 'corporate'
 and corporate.is_primary_brand
where legacy_organization.entity_type = 'organization'
  and logo.subject_entity_id = legacy_organization.id;

-- ---------- access helpers and hierarchy invariants ------------------------

create or replace function private.can_manage_brand_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null and exists (
    select 1
    from public.brand_organizations organization
    where organization.id = p_organization_id
      and (
        organization.created_by = auth.uid()
        or private.has_org_role(
          organization.linked_org_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_view_brand_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null and exists (
    select 1
    from public.brand_organizations organization
    where organization.id = p_organization_id
      and (
        organization.created_by = auth.uid()
        or private.has_org_role(
          organization.linked_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or exists (
          select 1
          from public.brand_entities brand
          join public.logos logo on logo.subject_entity_id = brand.id
          where brand.brand_organization_id = organization.id
            and private.can_view_logo(logo.id)
        )
      )
  );
$$;

create or replace function private.can_manage_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_entity_id
      and (
        entity.created_by = auth.uid()
        or private.can_manage_brand_organization(entity.brand_organization_id)
        or private.has_org_role(
          entity.linked_org_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_view_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_entity_id
      and (
        entity.created_by = auth.uid()
        or private.can_view_brand_organization(entity.brand_organization_id)
        or private.has_org_role(
          entity.linked_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or exists (
          select 1
          from public.logos logo
          where logo.subject_entity_id = entity.id
            and private.can_view_logo(logo.id)
        )
      )
  );
$$;

revoke all on function private.can_manage_brand_organization(uuid) from public;
revoke all on function private.can_view_brand_organization(uuid) from public;
grant execute on function private.can_manage_brand_organization(uuid) to authenticated;
grant execute on function private.can_view_brand_organization(uuid) to anon, authenticated;

drop policy if exists brand_organizations_select on public.brand_organizations;
create policy brand_organizations_select on public.brand_organizations
  for select using (private.can_view_brand_organization(id));

drop policy if exists brand_organizations_insert on public.brand_organizations;
create policy brand_organizations_insert on public.brand_organizations
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      linked_org_id is null
      or private.has_org_role(
        linked_org_id,
        array['owner','admin']::public.org_role[]
      )
    )
  );

drop policy if exists brand_organizations_update on public.brand_organizations;
create policy brand_organizations_update on public.brand_organizations
  for update using (private.can_manage_brand_organization(id))
  with check (private.can_manage_brand_organization(id));

drop policy if exists brand_organizations_delete on public.brand_organizations;
create policy brand_organizations_delete on public.brand_organizations
  for delete using (private.can_manage_brand_organization(id));

-- Transitional policies accept both new Brands and legacy Organization rows.
drop policy if exists brand_entities_insert on public.brand_entities;
create policy brand_entities_insert on public.brand_entities
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      (
        brand_kind is not null
        and private.can_manage_brand_organization(brand_organization_id)
      )
      or (
        entity_type = 'organization'
        and brand_organization_id is null
        and (
          linked_org_id is null
          or private.has_org_role(
            linked_org_id,
            array['owner','admin']::public.org_role[]
          )
        )
      )
    )
  );

drop policy if exists brand_entities_update on public.brand_entities;
create policy brand_entities_update on public.brand_entities
  for update using (private.can_manage_brand_entity(id))
  with check (
    private.can_manage_brand_entity(id)
    and (
      brand_kind is null
      or private.can_manage_brand_organization(brand_organization_id)
    )
  );

create or replace function public.enforce_brand_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_kind text;
  parent_organization_id uuid;
begin
  -- Legacy Organization rows remain during the expand phase only.
  if new.brand_kind is null then
    if new.entity_type <> 'organization' then
      raise exception 'Every market-facing entity must have a brand kind.';
    end if;
    return new;
  end if;

  if new.brand_organization_id is null then
    raise exception 'Every Brand must belong to an Organization.';
  end if;
  if new.entity_type not in ('brand', 'business', 'audience') then
    raise exception 'A Brand cannot use Organization as its entity type.';
  end if;
  if new.brand_kind = 'corporate' and new.parent_brand_id is not null then
    raise exception 'A corporate Brand cannot inherit from another Brand.';
  end if;
  if new.is_primary_brand and new.brand_kind <> 'corporate' then
    raise exception 'Only a corporate Brand may be the primary Brand.';
  end if;

  if new.parent_brand_id is not null then
    select parent.brand_kind, parent.brand_organization_id
      into parent_kind, parent_organization_id
    from public.brand_entities parent
    where parent.id = new.parent_brand_id;

    if parent_kind is null then
      raise exception 'A parent Brand must reference another Brand.';
    end if;
    if parent_organization_id <> new.brand_organization_id then
      raise exception 'A Brand cannot inherit across Organizations.';
    end if;
    if new.brand_kind = 'business' and parent_kind <> 'corporate' then
      raise exception 'A business Brand may inherit only from a corporate Brand.';
    end if;
    if new.brand_kind = 'audience' and parent_kind <> 'business' then
      raise exception 'An audience Brand must inherit from a business Brand.';
    end if;
  elsif new.brand_kind = 'audience' then
    raise exception 'An audience Brand requires a parent business Brand.';
  end if;

  return new;
end;
$$;

drop trigger if exists brand_entities_enforce_brand_membership
  on public.brand_entities;
create trigger brand_entities_enforce_brand_membership
  before insert or update of
    entity_type,
    brand_kind,
    brand_organization_id,
    parent_brand_id,
    is_primary_brand
  on public.brand_entities
  for each row execute function public.enforce_brand_membership();

-- Transitional compatibility: readers and writers move in a separate app
-- deployment. Legacy Organization inserts/updates are mirrored so an older
-- server cannot create an inconsistent hierarchy during that interval.
create or replace function private.sync_legacy_brand_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entity_type <> 'organization' then
    return new;
  end if;

  insert into public.brand_organizations (
    id,
    name,
    organization_kind,
    linked_org_id,
    website,
    industry,
    location,
    description,
    status,
    source_kind,
    provenance,
    created_by,
    created_at,
    updated_at
  ) values (
    new.id,
    new.name,
    new.organization_kind,
    new.linked_org_id,
    new.website,
    new.industry,
    new.location,
    new.description,
    new.status,
    new.source_kind,
    new.provenance || jsonb_build_object(
      'mirrored_from', 'brand_entities.organization'
    ),
    new.created_by,
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update set
    name = excluded.name,
    organization_kind = excluded.organization_kind,
    linked_org_id = excluded.linked_org_id,
    website = excluded.website,
    industry = excluded.industry,
    location = excluded.location,
    description = excluded.description,
    status = excluded.status,
    source_kind = excluded.source_kind,
    provenance = public.brand_organizations.provenance || excluded.provenance,
    updated_at = excluded.updated_at;

  insert into public.brand_entities (
    name,
    entity_type,
    parent_entity_id,
    linked_org_id,
    website,
    industry,
    location,
    description,
    status,
    source_kind,
    provenance,
    created_by,
    created_at,
    updated_at,
    brand_organization_id,
    brand_kind,
    is_primary_brand
  )
  select
    new.name,
    'brand',
    new.id,
    new.linked_org_id,
    new.website,
    new.industry,
    new.location,
    new.description,
    new.status,
    new.source_kind,
    new.provenance || jsonb_build_object(
      'system_key', 'primary_corporate_brand',
      'mirrored_from_organization_id', new.id
    ),
    new.created_by,
    new.created_at,
    new.updated_at,
    new.id,
    'corporate',
    true
  where not exists (
    select 1
    from public.brand_entities brand
    where brand.brand_organization_id = new.id
      and brand.brand_kind = 'corporate'
      and brand.is_primary_brand
  );

  return new;
end;
$$;

drop trigger if exists brand_entities_sync_legacy_organization
  on public.brand_entities;
create trigger brand_entities_sync_legacy_organization
  after insert or update of
    name,
    entity_type,
    organization_kind,
    linked_org_id,
    website,
    industry,
    location,
    description,
    status,
    source_kind,
    provenance,
    updated_at
  on public.brand_entities
  for each row execute function private.sync_legacy_brand_organization();

create or replace function private.redirect_legacy_brand_profile_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  corporate_brand_id uuid;
begin
  select brand.id
    into corporate_brand_id
  from public.brand_entities legacy_organization
  join public.brand_entities brand
    on brand.brand_organization_id = legacy_organization.id
   and brand.brand_kind = 'corporate'
   and brand.is_primary_brand
  where legacy_organization.id = new.entity_id
    and legacy_organization.entity_type = 'organization'
  limit 1;

  if corporate_brand_id is not null then
    new.entity_id := corporate_brand_id;
  end if;
  return new;
end;
$$;

drop trigger if exists brand_profiles_redirect_legacy_subject
  on public.brand_profiles;
create trigger brand_profiles_redirect_legacy_subject
  before insert or update of entity_id
  on public.brand_profiles
  for each row execute function private.redirect_legacy_brand_profile_subject();

-- ---------- generation history and scalable Brand assets ------------------

create table if not exists public.brand_generation_runs (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.brand_entities(id) on delete restrict,
  external_job_id    uuid unique,
  legacy_campaign_id uuid,
  status             text not null default 'running'
                     check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  input              jsonb not null default '{}'::jsonb,
  steps              jsonb not null default '[]'::jsonb,
  usage              jsonb not null default '{}'::jsonb,
  metadata           jsonb not null default '{}'::jsonb,
  error_message      text,
  triggered_by       uuid references public.users(user_id) on delete set null,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.brand_generation_runs enable row level security;

drop index if exists public.brand_generation_runs_legacy_campaign_uq;
create index if not exists brand_generation_runs_legacy_campaign_idx
  on public.brand_generation_runs (legacy_campaign_id)
  where legacy_campaign_id is not null;
create index if not exists brand_generation_runs_brand_created_idx
  on public.brand_generation_runs (brand_id, created_at desc);

create table if not exists public.brand_assets (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references public.brand_entities(id) on delete restrict,
  generation_run_id  uuid references public.brand_generation_runs(id) on delete set null,
  legacy_campaign_id uuid,
  logo_id            text references public.logos(id) on delete set null,
  asset_kind         text not null check (
    asset_kind in (
      'logo', 'guideline', 'lp', 'narration', 'audio', 'video',
      'banner', 'mockup', 'document', 'other'
    )
  ),
  title              text not null,
  status             text not null default 'ready'
                     check (status in ('pending', 'ready', 'failed', 'archived')),
  source_kind        text not null default 'generated'
                     check (source_kind in ('uploaded', 'generated', 'imported', 'derived')),
  storage_path       text,
  public_path        text,
  metadata           jsonb not null default '{}'::jsonb,
  created_by         uuid references public.users(user_id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.brand_assets enable row level security;

create index if not exists brand_assets_brand_kind_created_idx
  on public.brand_assets (brand_id, asset_kind, created_at desc);
create index if not exists brand_assets_generation_run_idx
  on public.brand_assets (generation_run_id);
create index if not exists brand_assets_legacy_campaign_idx
  on public.brand_assets (legacy_campaign_id)
  where legacy_campaign_id is not null;

drop policy if exists brand_generation_runs_select
  on public.brand_generation_runs;
create policy brand_generation_runs_select on public.brand_generation_runs
  for select using (private.can_view_brand_entity(brand_id));
drop policy if exists brand_generation_runs_insert
  on public.brand_generation_runs;
create policy brand_generation_runs_insert on public.brand_generation_runs
  for insert to authenticated with check (
    triggered_by = auth.uid()
    and private.can_manage_brand_entity(brand_id)
  );
drop policy if exists brand_generation_runs_update
  on public.brand_generation_runs;
create policy brand_generation_runs_update on public.brand_generation_runs
  for update using (private.can_manage_brand_entity(brand_id))
  with check (private.can_manage_brand_entity(brand_id));
drop policy if exists brand_generation_runs_delete
  on public.brand_generation_runs;
create policy brand_generation_runs_delete on public.brand_generation_runs
  for delete using (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_assets_select on public.brand_assets;
create policy brand_assets_select on public.brand_assets
  for select using (private.can_view_brand_entity(brand_id));
drop policy if exists brand_assets_insert on public.brand_assets;
create policy brand_assets_insert on public.brand_assets
  for insert to authenticated with check (
    created_by = auth.uid()
    and private.can_manage_brand_entity(brand_id)
  );
drop policy if exists brand_assets_update on public.brand_assets;
create policy brand_assets_update on public.brand_assets
  for update using (private.can_manage_brand_entity(brand_id))
  with check (private.can_manage_brand_entity(brand_id));
drop policy if exists brand_assets_delete on public.brand_assets;
create policy brand_assets_delete on public.brand_assets
  for delete using (private.can_manage_brand_entity(brand_id));

-- Preserve existing DB-backed run history. A Campaign row without an explicit
-- campaign_run still becomes one generation run so its source and Brand Kit
-- snapshot remain traceable.
insert into public.brand_generation_runs (
  id,
  brand_id,
  external_job_id,
  legacy_campaign_id,
  status,
  input,
  steps,
  usage,
  metadata,
  error_message,
  triggered_by,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  run.id,
  campaign.brand_entity_id,
  run.external_job_id,
  campaign.id,
  run.status,
  jsonb_build_object(
    'source_url', campaign.source_url,
    'selected_logo_id', campaign.logo_id,
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', source.id,
          'type', source.source_type,
          'url', source.source_url,
          'storage_path', source.storage_path,
          'metadata', source.metadata
        ) order by source.created_at, source.id
      )
      from public.campaign_sources source
      where source.campaign_id = campaign.id
    ), '[]'::jsonb)
  ),
  run.steps,
  run.usage,
  jsonb_build_object(
    'migrated_from', 'campaign_runs',
    'brand_kit_snapshot', campaign.brand_kit
  ),
  run.error_message,
  run.triggered_by,
  run.started_at,
  run.finished_at,
  run.created_at,
  coalesce(run.finished_at, run.created_at)
from public.campaign_runs run
join public.campaigns campaign on campaign.id = run.campaign_id
where not exists (
  select 1 from public.brand_generation_runs existing
  where existing.id = run.id
);

insert into public.brand_generation_runs (
  brand_id,
  external_job_id,
  legacy_campaign_id,
  status,
  input,
  metadata,
  error_message,
  triggered_by,
  started_at,
  finished_at,
  created_at,
  updated_at
)
select
  campaign.brand_entity_id,
  campaign.id,
  campaign.id,
  case campaign.status
    when 'running' then 'running'
    when 'failed' then 'failed'
    when 'archived' then 'canceled'
    else 'succeeded'
  end,
  jsonb_build_object(
    'source_url', campaign.source_url,
    'selected_logo_id', campaign.logo_id,
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', source.id,
          'type', source.source_type,
          'url', source.source_url,
          'storage_path', source.storage_path,
          'metadata', source.metadata
        ) order by source.created_at, source.id
      )
      from public.campaign_sources source
      where source.campaign_id = campaign.id
    ), '[]'::jsonb)
  ),
  jsonb_build_object(
    'migrated_from', 'campaigns',
    'brand_kit_snapshot', campaign.brand_kit
  ),
  null,
  campaign.created_by,
  campaign.created_at,
  case when campaign.status = 'running' then null else campaign.updated_at end,
  campaign.created_at,
  campaign.updated_at
from public.campaigns campaign
where not exists (
  select 1 from public.brand_generation_runs existing
  where existing.legacy_campaign_id = campaign.id
);

insert into public.brand_assets (
  id,
  brand_id,
  generation_run_id,
  legacy_campaign_id,
  asset_kind,
  title,
  status,
  source_kind,
  storage_path,
  public_path,
  metadata,
  created_by,
  created_at,
  updated_at
)
select
  artifact.id,
  campaign.brand_entity_id,
  generation.id,
  campaign.id,
  artifact.artifact_type,
  campaign.name || ' ' || case artifact.artifact_type
    when 'lp' then 'LP'
    when 'video' then '動画'
    when 'audio' then '音声'
    when 'narration' then 'ナレーション'
    when 'banner' then 'バナー'
    when 'mockup' then 'モックアップ'
    else artifact.artifact_type
  end,
  artifact.status,
  'generated',
  artifact.storage_path,
  artifact.public_path,
  artifact.metadata || jsonb_build_object(
    'migrated_from', 'campaign_artifacts',
    'legacy_run_id', artifact.run_id,
    'legacy_visibility', campaign.visibility,
    'legacy_public_slug', campaign.public_slug
  ),
  campaign.created_by,
  artifact.created_at,
  artifact.updated_at
from public.campaign_artifacts artifact
join public.campaigns campaign on campaign.id = artifact.campaign_id
left join public.brand_generation_runs generation
  on generation.id = artifact.run_id
on conflict (id) do nothing;

-- Current generated LPs may predate campaign_artifacts. Register one logical
-- LP asset per legacy Campaign when no explicit LP artifact exists.
insert into public.brand_assets (
  brand_id,
  generation_run_id,
  legacy_campaign_id,
  asset_kind,
  title,
  status,
  source_kind,
  public_path,
  metadata,
  created_by,
  created_at,
  updated_at
)
select
  campaign.brand_entity_id,
  generation.id,
  campaign.id,
  'lp',
  campaign.name || ' LP',
  case campaign.status
    when 'running' then 'pending'
    when 'failed' then 'failed'
    when 'archived' then 'archived'
    else 'ready'
  end,
  'generated',
  '/c/' || campaign.id::text,
  jsonb_build_object(
    'migrated_from', 'campaigns',
    'brand_kit_snapshot', campaign.brand_kit,
    'legacy_visibility', campaign.visibility,
    'legacy_public_slug', campaign.public_slug,
    'legacy_published_at', campaign.published_at
  ),
  campaign.created_by,
  campaign.created_at,
  campaign.updated_at
from public.campaigns campaign
left join lateral (
  select run.id
  from public.brand_generation_runs run
  where run.legacy_campaign_id = campaign.id
  order by run.created_at desc, run.id desc
  limit 1
) generation on true
where not exists (
  select 1
  from public.brand_assets asset
  where asset.legacy_campaign_id = campaign.id
    and asset.asset_kind = 'lp'
);

-- ---------- standalone logo intake now creates a container + Brand ---------

create unique index if not exists brand_organizations_personal_placeholder_uq
  on public.brand_organizations (created_by)
  where linked_org_id is null
    and provenance ->> 'system_key' = 'unassigned_logo_organization';
create unique index if not exists brand_organizations_workspace_placeholder_uq
  on public.brand_organizations (linked_org_id)
  where linked_org_id is not null
    and provenance ->> 'system_key' = 'unassigned_logo_organization';
create unique index if not exists brand_entities_placeholder_brand_uq
  on public.brand_entities (brand_organization_id)
  where brand_kind = 'business'
    and provenance ->> 'system_key' = 'unassigned_logo_brand';

create or replace function private.ensure_logo_subject_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  container_id uuid;
  placeholder_brand_id uuid;
  corporate_brand_id uuid;
  creator_id uuid;
  container_linked_org_id uuid;
begin
  if new.subject_entity_id is not null then
    if exists (
      select 1 from public.brand_entities brand
      where brand.id = new.subject_entity_id
        and brand.brand_kind is not null
    ) then
      return new;
    end if;

    select brand.id
      into corporate_brand_id
    from public.brand_entities legacy_organization
    join public.brand_entities brand
      on brand.brand_organization_id = legacy_organization.id
     and brand.brand_kind = 'corporate'
     and brand.is_primary_brand
    where legacy_organization.id = new.subject_entity_id
      and legacy_organization.entity_type = 'organization'
    limit 1;

    if corporate_brand_id is null then
      raise exception 'A logo must belong to a Brand, not an Organization.';
    end if;
    new.subject_entity_id := corporate_brand_id;
    return new;
  end if;

  creator_id := coalesce(new.created_by, new.owner_user_id);

  if new.owner_org_id is not null then
    select organization.id
      into container_id
    from public.brand_organizations organization
    where organization.linked_org_id = new.owner_org_id
      and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
    limit 1;

    if container_id is null then
      insert into public.brand_organizations (
        name,
        organization_kind,
        linked_org_id,
        status,
        source_kind,
        provenance,
        created_by
      ) values (
        '名称未設定のOrganization',
        'other',
        new.owner_org_id,
        'inferred',
        'generated',
        jsonb_build_object(
          'system_key', 'unassigned_logo_organization',
          'reason', 'standalone_logo_without_subject'
        ),
        creator_id
      )
      on conflict (linked_org_id)
        where linked_org_id is not null
          and provenance ->> 'system_key' = 'unassigned_logo_organization'
      do nothing
      returning id into container_id;
    end if;
  else
    select organization.id
      into container_id
    from public.brand_organizations organization
    where organization.linked_org_id is null
      and organization.created_by = new.owner_user_id
      and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
    limit 1;

    if container_id is null then
      insert into public.brand_organizations (
        name,
        organization_kind,
        status,
        source_kind,
        provenance,
        created_by
      ) values (
        '名称未設定のOrganization',
        'other',
        'inferred',
        'generated',
        jsonb_build_object(
          'system_key', 'unassigned_logo_organization',
          'reason', 'standalone_logo_without_subject'
        ),
        new.owner_user_id
      )
      on conflict (created_by)
        where linked_org_id is null
          and provenance ->> 'system_key' = 'unassigned_logo_organization'
      do nothing
      returning id into container_id;
    end if;
  end if;

  if container_id is null then
    raise exception 'Could not create an Organization container for logo %', new.id;
  end if;

  select organization.linked_org_id
    into container_linked_org_id
  from public.brand_organizations organization
  where organization.id = container_id;

  select brand.id
    into placeholder_brand_id
  from public.brand_entities brand
  where brand.brand_organization_id = container_id
    and brand.brand_kind = 'business'
    and brand.provenance ->> 'system_key' = 'unassigned_logo_brand'
  limit 1;

  if placeholder_brand_id is null then
    insert into public.brand_entities (
      name,
      entity_type,
      linked_org_id,
      status,
      source_kind,
      provenance,
      created_by,
      brand_organization_id,
      brand_kind
    ) values (
      '未整理のブランドアセット',
      'brand',
      container_linked_org_id,
      'inferred',
      'generated',
      jsonb_build_object(
        'system_key', 'unassigned_logo_brand',
        'reason', 'standalone_logo_without_subject'
      ),
      creator_id,
      container_id,
      'business'
    )
    on conflict (brand_organization_id)
      where brand_kind = 'business'
        and provenance ->> 'system_key' = 'unassigned_logo_brand'
    do nothing
    returning id into placeholder_brand_id;
  end if;

  if placeholder_brand_id is null then
    select brand.id
      into placeholder_brand_id
    from public.brand_entities brand
    where brand.brand_organization_id = container_id
      and brand.brand_kind = 'business'
      and brand.provenance ->> 'system_key' = 'unassigned_logo_brand'
    limit 1;
  end if;

  if placeholder_brand_id is null then
    raise exception 'Could not create a placeholder Brand for logo %', new.id;
  end if;

  new.subject_entity_id := placeholder_brand_id;
  return new;
end;
$$;

revoke all on function private.ensure_logo_subject_entity() from public;
grant execute on function private.ensure_logo_subject_entity() to service_role;

drop trigger if exists logos_ensure_subject_entity on public.logos;
create trigger logos_ensure_subject_entity
  before insert or update of subject_entity_id, owner_user_id, owner_org_id
  on public.logos
  for each row execute function private.ensure_logo_subject_entity();

comment on table public.brand_organizations is
  'Real-world Organization container. It owns no profile, logo, or generated marketing asset directly.';
comment on table public.brand_entities is
  'Market-facing Brands. corporate, business, and audience are category differences with one common capability model.';
comment on column public.brand_entities.brand_organization_id is
  'Required Organization container for a Brand. NULL only on legacy Organization rows during the expand phase.';
comment on column public.brand_entities.parent_brand_id is
  'Optional inheritance parent inside the same Organization; independent from legacy parent_entity_id.';
comment on table public.brand_generation_runs is
  'Technical generation history: inputs, processing steps, usage/cost, errors, and immutable snapshots.';
comment on table public.brand_assets is
  'Scalable Brand-owned asset catalog for LPs, videos, banners, mockups, documents, and future output types.';

-- Migration contract checks. Organization-owned profiles/logos should now be
-- zero, while every migrated business/audience row has a container and kind.
do $$
begin
  if exists (
    select 1
    from public.brand_organizations organization
    where not exists (
      select 1
      from public.brand_entities brand
      where brand.brand_organization_id = organization.id
        and brand.brand_kind = 'corporate'
        and brand.is_primary_brand
    )
  ) then
    raise exception 'Migration contract failed: an Organization has no primary corporate Brand.';
  end if;

  if exists (
    select 1
    from public.brand_profiles profile
    join public.brand_entities entity on entity.id = profile.entity_id
    where entity.entity_type = 'organization'
  ) then
    raise exception 'Migration contract failed: a legacy Organization still owns a brand profile.';
  end if;

  if exists (
    select 1
    from public.logos logo
    join public.brand_entities entity on entity.id = logo.subject_entity_id
    where entity.entity_type = 'organization'
  ) then
    raise exception 'Migration contract failed: a legacy Organization still owns a logo.';
  end if;

  if exists (
    select 1
    from public.brand_entities entity
    where entity.entity_type in ('business', 'audience')
      and (entity.brand_organization_id is null or entity.brand_kind is null)
  ) then
    raise exception 'Migration contract failed: a legacy business/audience Brand was not mapped.';
  end if;

  if exists (
    select 1
    from public.campaigns campaign
    where not exists (
      select 1
      from public.brand_generation_runs run
      where run.legacy_campaign_id = campaign.id
    )
  ) then
    raise exception 'Migration contract failed: a Campaign has no migrated generation run.';
  end if;

  if exists (
    select 1
    from public.campaign_artifacts artifact
    where not exists (
      select 1
      from public.brand_assets asset
      where asset.id = artifact.id
    )
  ) then
    raise exception 'Migration contract failed: a Campaign artifact was not migrated.';
  end if;
end;
$$;

select
  to_regclass('public.brand_organizations') is not null as has_brand_organizations,
  to_regclass('public.brand_generation_runs') is not null as has_brand_generation_runs,
  to_regclass('public.brand_assets') is not null as has_brand_assets,
  not exists (
    select 1
    from public.brand_profiles profile
    join public.brand_entities entity on entity.id = profile.entity_id
    where entity.entity_type = 'organization'
  ) as organization_has_no_profile,
  not exists (
    select 1
    from public.logos logo
    join public.brand_entities entity on entity.id = logo.subject_entity_id
    where entity.entity_type = 'organization'
  ) as organization_has_no_logo,
  not exists (
    select 1
    from public.brand_entities entity
    where entity.entity_type in ('business', 'audience')
      and (
        entity.brand_organization_id is null
        or entity.brand_kind is null
      )
  ) as all_legacy_brands_mapped;
