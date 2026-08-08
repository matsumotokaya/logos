-- Finish the V2 cutover. Keep only the WealthPark Lab sake-event closure,
-- remove disposable demo data, and make the expanded Brand/Take model the
-- sole database contract.

-- Remove the old campaign/asset/profile persistence layer first so its
-- RESTRICT foreign keys cannot retain disposable Brands during the reset.
drop table if exists public.campaign_artifacts;
drop table if exists public.campaign_sources;
drop table if exists public.campaign_runs;
drop table if exists public.campaigns;
drop table if exists public.brand_assets;
drop table if exists public.brand_generation_runs;
drop table if exists public.brand_profiles;
drop table if exists public.logo_presentations;

drop function if exists public.enforce_campaign_brand_boundary();
drop function if exists public.brand_entity_is_ancestor(uuid, uuid);
drop function if exists private.redirect_legacy_brand_profile_subject();

do $$
declare
  keep_take_id uuid;
  keep_brand_id uuid;
  keep_work_id uuid;
  keep_organization_id uuid;
  keep_render_id uuid;
  keep_artifact_id uuid;
begin
  if (
    select count(*)
    from public.takes
    where template_id = 'event-promo'
      and title = '世界が恋する日本酒'
  ) <> 1 then
    raise exception 'Expected exactly one sake-event Take.';
  end if;

  select take.id, take.brand_id, take.work_id
    into keep_take_id, keep_brand_id, keep_work_id
  from public.takes take
  where take.template_id = 'event-promo'
    and take.title = '世界が恋する日本酒';

  if keep_work_id is null then
    raise exception 'The sake-event Take must belong to a Work.';
  end if;
  if (select count(*) from public.take_inputs where take_id = keep_take_id) <> 13 then
    raise exception 'Expected 13 pinned sake-event Materials.';
  end if;

  select brand.brand_organization_id
    into keep_organization_id
  from public.brand_entities brand
  where brand.id = keep_brand_id
    and brand.name = 'WealthPark Lab';
  if keep_organization_id is null then
    raise exception 'The WealthPark Lab Brand or Organization is missing.';
  end if;

  select render.id, render.latest_artifact_id
    into keep_render_id, keep_artifact_id
  from public.take_renders render
  where render.take_id = keep_take_id
    and render.format = 'mp4'
  order by render.created_at
  limit 1;
  if keep_render_id is null or keep_artifact_id is null then
    raise exception 'The sake-event ready MP4 Artifact is missing.';
  end if;

  -- Product data is disposable. Account/workspace rows and template/config
  -- definitions are intentionally retained so sign-in and future creation
  -- keep working after the reset.
  delete from public.orders;
  delete from public.inventory_items;
  delete from public.generation_events;
  delete from public.bookmarks;

  delete from public.publications
  where render_id in (
    select id from public.take_renders where take_id <> keep_take_id
  );
  delete from public.canonical_slots
  where take_id <> keep_take_id or logo_id is not null;
  delete from public.takes where id <> keep_take_id;

  delete from public.render_artifacts
  where render_id = keep_render_id and id <> keep_artifact_id;
  delete from public.brand_materials
  where id not in (
    select material_id from public.take_inputs where take_id = keep_take_id
  );
  delete from public.works where id <> keep_work_id;

  -- The event owns copied/pinned Materials, not the historical logo row.
  delete from public.logos;

  delete from public.brand_knowledge_values;
  delete from public.brand_knowledge_claims;
  delete from public.brand_variants;

  update public.brand_entities
  set parent_brand_id = null,
      brand_kind = 'business',
      is_primary_brand = false,
      updated_at = now()
  where id = keep_brand_id;
  delete from public.brand_entities where id <> keep_brand_id;

  update public.brand_organizations
  set parent_organization_id = null,
      updated_at = now()
  where id = keep_organization_id;
  delete from public.brand_organizations where id <> keep_organization_id;

  update public.takes
  set status = 'ready', updated_at = now()
  where id = keep_take_id;
  update public.take_renders
  set status = 'ready', latest_artifact_id = keep_artifact_id, updated_at = now()
  where id = keep_render_id;
end;
$$;

-- Remove expand-phase Organization mirroring and the old hierarchy.
drop trigger if exists brand_entities_sync_legacy_organization on public.brand_entities;
drop function if exists private.sync_legacy_brand_organization();
drop trigger if exists brand_entities_enforce_hierarchy on public.brand_entities;
drop function if exists public.enforce_brand_entity_hierarchy();

drop trigger if exists brand_entities_enforce_brand_membership on public.brand_entities;
drop policy if exists brand_entities_insert on public.brand_entities;
drop policy if exists brand_entities_update on public.brand_entities;
alter table public.brand_entities
  drop constraint if exists brand_entities_hierarchy_check,
  drop constraint if exists brand_entities_organization_kind_check,
  drop constraint if exists brand_entities_entity_type_check,
  drop constraint if exists brand_entities_check,
  drop constraint if exists brand_entities_parent_entity_id_fkey;
alter table public.brand_entities
  drop column if exists entity_type,
  drop column if exists parent_entity_id,
  drop column if exists organization_kind;
alter table public.brand_entities
  alter column brand_kind set not null,
  alter column brand_organization_id set not null;

create policy brand_entities_insert on public.brand_entities
  for insert to authenticated with check (
    created_by = auth.uid()
    and private.can_manage_brand_organization(brand_organization_id)
  );

create policy brand_entities_update on public.brand_entities
  for update to authenticated
  using (private.can_manage_brand_entity(id))
  with check (
    private.can_manage_brand_entity(id)
    and private.can_manage_brand_organization(brand_organization_id)
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
  if new.brand_kind = 'corporate' and new.parent_brand_id is not null then
    raise exception 'A corporate Brand cannot inherit from another Brand.';
  end if;
  if new.is_primary_brand and new.brand_kind <> 'corporate' then
    raise exception 'Only a corporate Brand may be the primary Brand.';
  end if;

  if new.parent_brand_id is not null then
    if new.parent_brand_id = new.id then
      raise exception 'A Brand cannot inherit from itself.';
    end if;
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
  end if;
  return new;
end;
$$;

create trigger brand_entities_enforce_brand_membership
  before insert or update of
    brand_kind, brand_organization_id, parent_brand_id, is_primary_brand
  on public.brand_entities
  for each row execute function public.enforce_brand_membership();

-- Standalone logo intake still creates a real Organization + Brand, now using
-- only the final columns.
create or replace function private.ensure_logo_subject_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  container_id uuid;
  placeholder_brand_id uuid;
  creator_id uuid;
  container_linked_org_id uuid;
begin
  if new.subject_entity_id is not null then
    if not exists (
      select 1 from public.brand_entities brand
      where brand.id = new.subject_entity_id
    ) then
      raise exception 'A logo must belong to a Brand.';
    end if;
    return new;
  end if;

  creator_id := coalesce(new.created_by, new.owner_user_id);
  select organization.id into container_id
  from public.brand_organizations organization
  where (
    new.owner_org_id is not null
    and organization.linked_org_id = new.owner_org_id
    and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
  ) or (
    new.owner_org_id is null
    and organization.linked_org_id is null
    and organization.created_by = new.owner_user_id
    and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
  )
  limit 1;

  if container_id is null then
    insert into public.brand_organizations (
      name, organization_kind, linked_org_id, status, source_kind, provenance, created_by
    ) values (
      '名称未設定のOrganization', 'other', new.owner_org_id, 'inferred', 'generated',
      jsonb_build_object('system_key', 'unassigned_logo_organization', 'reason', 'standalone_logo_without_subject'),
      creator_id
    )
    on conflict do nothing
    returning id into container_id;
  end if;

  if container_id is null then
    select organization.id into container_id
    from public.brand_organizations organization
    where (
      new.owner_org_id is not null
      and organization.linked_org_id = new.owner_org_id
      and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
    ) or (
      new.owner_org_id is null
      and organization.linked_org_id is null
      and organization.created_by = new.owner_user_id
      and organization.provenance ->> 'system_key' = 'unassigned_logo_organization'
    )
    limit 1;
  end if;
  if container_id is null then
    raise exception 'Could not create an Organization container for logo %', new.id;
  end if;

  select linked_org_id into container_linked_org_id
  from public.brand_organizations where id = container_id;
  select brand.id into placeholder_brand_id
  from public.brand_entities brand
  where brand.brand_organization_id = container_id
    and brand.brand_kind = 'business'
    and brand.provenance ->> 'system_key' = 'unassigned_logo_brand'
  limit 1;

  if placeholder_brand_id is null then
    insert into public.brand_entities (
      name, linked_org_id, status, source_kind, provenance, created_by,
      brand_organization_id, brand_kind
    ) values (
      '未整理のブランドアセット', container_linked_org_id, 'inferred', 'generated',
      jsonb_build_object('system_key', 'unassigned_logo_brand', 'reason', 'standalone_logo_without_subject'),
      creator_id, container_id, 'business'
    )
    on conflict do nothing
    returning id into placeholder_brand_id;
  end if;
  if placeholder_brand_id is null then
    select brand.id into placeholder_brand_id
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

revoke all on function private.ensure_logo_subject_entity() from public, anon, authenticated;
grant execute on function private.ensure_logo_subject_entity() to service_role;

comment on table public.brand_entities is
  'Market-facing Brands. Every row has a Brand kind and belongs to one Organization.';
comment on column public.brand_entities.brand_organization_id is
  'Required real-world Organization container for this Brand.';
comment on column public.brand_entities.parent_brand_id is
  'Optional inheritance parent inside the same Organization.';
