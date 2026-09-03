-- 0056: v3 entity model — workspace Organization + single Brand tree.
--
-- Decision record: docs/deliverable-architecture.md §19 (2026-09-03).
--   * public.organizations (the access workspace) becomes THE Organization.
--     public.brand_organizations (the real-world container) is retired.
--   * Brand (brand_entities) is the only user-creatable entity: a free
--     parent_id tree inside one workspace org. brand_kind gains
--     'organization' and is a relabelable category, not structure.
--   * Works are retired. Events/campaigns are child Brands; material scope
--     shrinks to brand/take.
--   * Identity is the id alone. source_url is a plain attribute used only
--     for the "this URL is already registered" dialog.
--
-- DATA: experimental data is wiped by agreement (2026-09-03). No backfill.
--
-- SYNC: create_v2_take and clone_event_promo_take change signatures here.
-- Apply this migration together with the v3 application code (phase 2);
-- the running app must not straddle the two contracts.

begin;

-- ---------------------------------------------------------------------------
-- 1. Wipe the experimental brand world. TRUNCATE ... CASCADE follows every
--    inbound FK (brand_entities, takes, renders, artifacts, publications,
--    materials, knowledge, logos and the whole logo subtree). Workspace
--    tables (organizations, org_members, org_invites, users) survive.
-- ---------------------------------------------------------------------------

truncate table public.brand_organizations cascade;

-- ---------------------------------------------------------------------------
-- 2. Workspace org gains the personal flag (auto-created single-member org).
--    Personal ownership (owner_user_id) unification lands in phase 5; this
--    flag and helper exist now so nothing new has to invent them later.
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists is_personal boolean not null default false;

create or replace function private.ensure_personal_org(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  personal_org_id uuid;
begin
  if p_user_id is null then
    raise exception 'ensure_personal_org requires a user id.';
  end if;
  -- One personal org per user; serialize concurrent first-touch.
  perform pg_advisory_xact_lock(hashtextextended('personal_org:' || p_user_id::text, 0));

  select org.org_id into personal_org_id
  from public.organizations org
  where org.is_personal and org.created_by = p_user_id
  limit 1;
  if personal_org_id is not null then
    return personal_org_id;
  end if;

  insert into public.organizations (org_id, name, created_by, is_personal)
  values (gen_random_uuid(), 'Personal', p_user_id, true)
  returning org_id into personal_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (personal_org_id, p_user_id, 'owner')
  on conflict do nothing;

  return personal_org_id;
end;
$$;

revoke all on function private.ensure_personal_org(uuid) from public, anon, authenticated;

-- The app's entry point: resolve the caller's workspace, creating their
-- personal one on first use. Takes no argument on purpose — a user id
-- parameter would let any caller create an org owned by someone else.
create or replace function public.ensure_my_workspace()
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  existing_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
  -- An org the caller already belongs to beats creating a second one.
  select m.org_id into existing_org_id
  from public.org_members m
  join public.organizations o on o.org_id = m.org_id
  where m.user_id = auth.uid()
  order by o.is_personal desc, o.created_at
  limit 1;
  if existing_org_id is not null then
    return existing_org_id;
  end if;
  return private.ensure_personal_org(auth.uid());
end;
$$;

revoke all on function public.ensure_my_workspace() from public, anon;
grant execute on function public.ensure_my_workspace() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Brand tree: brands belong to a workspace org, parent freely inside it.
-- ---------------------------------------------------------------------------

-- Postgres refuses to drop a column that a policy, trigger or constraint names,
-- so every dependent on the three retired columns goes first. Each one is
-- recreated below against organization_id; nothing is silently lost.
--   brand_organization_id → policies brand_entities_insert / _update, and the
--                           membership trigger's UPDATE OF column list
--   is_primary_brand      → the same trigger, plus the primary-brand check
drop policy if exists brand_entities_insert on public.brand_entities;
drop policy if exists brand_entities_update on public.brand_entities;
drop trigger if exists brand_entities_enforce_brand_membership
  on public.brand_entities;
alter table public.brand_entities
  drop constraint if exists brand_entities_primary_brand_check;

alter table public.brand_entities
  add column organization_id uuid references public.organizations(org_id) on delete restrict,
  add column source_url text;

-- The table is empty (§1), so the invariant can be enforced immediately.
alter table public.brand_entities
  alter column organization_id set not null;

alter table public.brand_entities
  drop column brand_organization_id,
  drop column linked_org_id,
  drop column is_primary_brand;

alter table public.brand_entities
  drop constraint if exists brand_entities_brand_kind_check;
alter table public.brand_entities
  add constraint brand_entities_brand_kind_check check (
    brand_kind in ('organization','corporate','business','service','product','media','event')
  );

comment on column public.brand_entities.brand_kind is
  'Category label seeded by classification and freely changed by the user. Labels do not constrain the tree.';
comment on column public.brand_entities.organization_id is
  'The workspace this brand lives in. All sharing, quotas and the brand tree are scoped here.';
comment on column public.brand_entities.source_url is
  'The URL the user registered (normalized). Not unique — duplicates are allowed; it only powers the "already registered" dialog and re-ingest.';

create index if not exists brand_entities_organization_idx
  on public.brand_entities (organization_id);
create index if not exists brand_entities_parent_idx
  on public.brand_entities (parent_brand_id);
create index if not exists brand_entities_source_url_idx
  on public.brand_entities (organization_id, source_url)
  where source_url is not null;

-- Tree rules shrink to: same workspace, no self-parent, no cycles.
-- (The corporate/primary special cases are gone — labels are not structure.)
create or replace function public.enforce_brand_membership()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  parent_org uuid;
  cursor_id uuid;
  depth integer := 0;
begin
  if new.parent_brand_id is null then
    return new;
  end if;
  if new.parent_brand_id = new.id then
    raise exception 'A Brand cannot be its own parent.';
  end if;

  select parent.organization_id into parent_org
  from public.brand_entities parent
  where parent.id = new.parent_brand_id;
  if parent_org is null then
    raise exception 'A parent Brand must reference another Brand.';
  end if;
  if parent_org <> new.organization_id then
    raise exception 'A Brand cannot be nested under a Brand in another workspace.';
  end if;

  -- Walk up from the requested parent; hitting ourselves means a cycle.
  cursor_id := new.parent_brand_id;
  while cursor_id is not null loop
    depth := depth + 1;
    if depth > 100 then
      raise exception 'Brand tree is too deep.';
    end if;
    select parent_brand_id into cursor_id
    from public.brand_entities where id = cursor_id;
    if cursor_id = new.id then
      raise exception 'Moving this Brand under its own descendant would create a cycle.';
    end if;
  end loop;

  return new;
end;
$$;

-- Recreated with the v3 column list: brand_kind is a label that gates nothing,
-- so only a move (organization_id) or a reparent needs checking.
create trigger brand_entities_enforce_brand_membership
  before insert or update of organization_id, parent_brand_id
  on public.brand_entities
  for each row execute function public.enforce_brand_membership();

-- ---------------------------------------------------------------------------
-- 4. Access helpers now read the brand's workspace org directly.
--    can_edit_brand_core / can_edit_brand_output are unchanged: they call
--    can_manage_brand_entity plus brand grants.
-- ---------------------------------------------------------------------------

create or replace function private.can_view_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_entity_id
      and (
        entity.created_by = auth.uid()
        or private.has_org_role(
          entity.organization_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or private.has_brand_grant(
          entity.id,
          array['manager','editor','viewer']::public.logo_access_role[],
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

create or replace function private.can_manage_brand_entity(p_entity_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_entity_id
      and (
        entity.created_by = auth.uid()
        or private.has_org_role(
          entity.organization_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function private.can_admin_brand(p_brand_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  select p_brand_id is not null and exists (
    select 1
    from public.brand_entities entity
    where entity.id = p_brand_id
      and (
        entity.created_by = auth.uid()
        or private.has_org_role(
          entity.organization_id,
          array['owner','admin']::public.org_role[]
        )
      )
  );
$$;

-- Both policies were dropped in §3 because they named brand_organization_id.
create policy brand_entities_insert on public.brand_entities
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.has_org_role(
      organization_id,
      array['owner','admin','editor']::public.org_role[]
    )
  );

create policy brand_entities_update on public.brand_entities
  for update to authenticated
  using (private.can_manage_brand_entity(id))
  with check (
    private.can_manage_brand_entity(id)
    and private.has_org_role(
      organization_id,
      array['owner','admin','editor']::public.org_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Retire Works. Material scope shrinks to brand/take.
-- ---------------------------------------------------------------------------

alter table public.takes drop column work_id;

-- Same rule as §3: the constraint and the promotion trigger both name
-- work_id, so they go before the column and are recreated after it.
alter table public.brand_materials
  drop constraint if exists materials_scope_owner;
drop trigger if exists brand_materials_enforce_promotion
  on public.brand_materials;

alter table public.brand_materials drop column work_id;

alter table public.brand_materials
  add constraint materials_scope_owner check (
    (scope = 'brand' and take_id is null)
    or (scope = 'take' and take_id is not null)
  );

create or replace function private.enforce_material_promotion()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  old_rank integer;
  new_rank integer;
begin
  old_rank := case old.scope when 'take' then 1 else 2 end;
  new_rank := case new.scope when 'take' then 1 else 2 end;

  if new_rank < old_rank then
    raise exception 'A material''s scope can only widen (take -> brand).'
      using errcode = '42501';
  end if;

  if new_rank > old_rank then
    new.take_id := null;
    new.promoted_at := now();
    new.promoted_by := auth.uid();
  end if;

  if new.brand_id is distinct from old.brand_id then
    raise exception 'A material cannot be moved to another Brand.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger brand_materials_enforce_promotion
  before update of scope, take_id, brand_id
  on public.brand_materials
  for each row execute function private.enforce_material_promotion();

drop function if exists public.delete_work(uuid, text);
drop table public.works;

-- delete_take: the promote disposition now has exactly one wider scope.
create or replace function public.delete_take(p_take_id uuid, p_material_disposition text default 'require_decision'::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_brand_id uuid;
  deletion_id uuid := gen_random_uuid();
  at_risk jsonb := '[]'::jsonb;
  object_keys text[] := '{}'::text[];
begin
  if p_material_disposition not in ('require_decision','promote','discard') then
    raise exception 'INVALID_MATERIAL_DISPOSITION' using errcode = '22023';
  end if;

  select brand_id into target_brand_id
  from public.takes where id = p_take_id;
  if target_brand_id is null then
    raise exception 'TAKE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.can_admin_brand(target_brand_id) then
    raise exception 'TAKE_DELETE_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.publications publication
    join public.take_renders render on render.id = publication.render_id
    where render.take_id = p_take_id and publication.status = 'live'
  ) then
    raise exception 'TAKE_DELETE_BLOCKED_PUBLISHED' using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', material.id, 'label', material.label,
                                 'kind', material.kind) order by material.created_at),
    '[]'::jsonb
  )
  into at_risk
  from public.brand_materials material
  where material.take_id = p_take_id
    and material.scope = 'take'
    and material.source_kind in ('upload','url_fetch','ai_generated');

  if jsonb_array_length(at_risk) > 0 then
    if p_material_disposition = 'require_decision' then
      raise exception 'TAKE_DELETE_NEEDS_MATERIAL_DECISION'
        using errcode = '23514', detail = at_risk::text;
    elsif p_material_disposition = 'promote' then
      update public.brand_materials
      set scope = 'brand',
          take_id = null,
          updated_at = now()
      where take_id = p_take_id
        and scope = 'take'
        and source_kind in ('upload','url_fetch','ai_generated');
    end if;
  end if;

  with doomed as (
    select material.r2_key as object_key
    from public.brand_materials material
    where material.take_id = p_take_id and material.r2_key is not null
    union
    select artifact.r2_key
    from public.render_artifacts artifact
    join public.take_renders render on render.id = artifact.render_id
    where render.take_id = p_take_id
  )
  select coalesce(array_agg(distinct doomed.object_key), '{}'::text[])
  into object_keys
  from doomed
  where doomed.object_key is not null
    and doomed.object_key <> ''
    and not exists (
      select 1 from public.brand_materials survivor
      where survivor.r2_key = doomed.object_key
        and survivor.take_id is distinct from p_take_id
    );

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select deletion_id, object_key, auth.uid()
  from unnest(object_keys) as object_key
  on conflict do nothing;

  delete from public.takes where id = p_take_id;

  return jsonb_build_object(
    'deletionId', deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'promotedMaterials',
      case when p_material_disposition = 'promote' then at_risk else '[]'::jsonb end
  );
end;
$$;

-- create_v2_take: the p_work_id parameter is gone.
drop function if exists public.create_v2_take(uuid, uuid, uuid, text, text, integer, integer, jsonb, text, uuid, text, text, jsonb);
create function public.create_v2_take(
  p_brand_id uuid,
  p_variant_id uuid,
  p_tool_kind text,
  p_template_id text,
  p_template_version integer,
  p_brief_schema_version integer,
  p_brief jsonb,
  p_title text,
  p_created_by uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_renders jsonb
)
returns table(take_id uuid, render_ids uuid[], created boolean)
language plpgsql
set search_path to ''
as $$
declare
  target_take_id uuid;
  inserted boolean := false;
  existing_hash text;
  target_render_ids uuid[];
begin
  if jsonb_typeof(p_renders) <> 'array' or jsonb_array_length(p_renders) = 0 then
    raise exception 'At least one default render is required.' using errcode = '22023';
  end if;
  if (p_idempotency_key is null) <> (p_request_hash is null) then
    raise exception 'idempotency_key and request_hash must be supplied together.'
      using errcode = '22023';
  end if;

  insert into public.takes (
    brand_id, variant_id, tool_kind, template_id, template_version,
    brief_schema_version, brief, title, status, created_by,
    idempotency_key, request_hash
  ) values (
    p_brand_id, p_variant_id, p_tool_kind, p_template_id,
    p_template_version, p_brief_schema_version, p_brief, p_title, 'draft',
    p_created_by, p_idempotency_key, p_request_hash
  )
  on conflict (brand_id, template_id, idempotency_key) do nothing
  returning id into target_take_id;

  if target_take_id is not null then
    inserted := true;
  elsif p_idempotency_key is not null then
    select take.id, take.request_hash
      into target_take_id, existing_hash
    from public.takes as take
    where take.brand_id = p_brand_id
      and take.template_id = p_template_id
      and take.idempotency_key = p_idempotency_key;

    if target_take_id is null then
      raise exception 'Idempotent Take could not be resolved after conflict.';
    end if;
    if existing_hash is distinct from p_request_hash then
      raise exception 'Idempotency key was reused with different Take input.'
        using errcode = '22023';
    end if;
  else
    raise exception 'Take creation did not return an id.';
  end if;

  if inserted then
    insert into public.take_renders (
      take_id, locale, aspect_ratio, theme, format, status
    )
    select
      target_take_id,
      render.locale,
      render.aspect_ratio,
      coalesce(render.theme, ''),
      render.format,
      'pending'
    from jsonb_to_recordset(p_renders) as render(
      locale text,
      aspect_ratio text,
      theme text,
      format text
    );
  end if;

  select array_agg(render.id order by render.created_at, render.id)
    into target_render_ids
  from public.take_renders as render
  where render.take_id = target_take_id;

  if coalesce(array_length(target_render_ids, 1), 0) = 0 then
    raise exception 'Take has no render rows.';
  end if;

  return query select target_take_id, target_render_ids, inserted;
end;
$$;

revoke all on function public.create_v2_take(uuid, uuid, text, text, integer, integer, jsonb, text, uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.create_v2_take(uuid, uuid, text, text, integer, integer, jsonb, text, uuid, text, text, jsonb)
  to authenticated, service_role;

-- clone_event_promo_take: no work linkage anymore.
drop function if exists public.clone_event_promo_take(uuid, uuid, uuid, uuid);
create function public.clone_event_promo_take(
  p_source_take_id uuid,
  p_new_take_id uuid,
  p_created_by uuid
)
returns table(source_take_id uuid, new_take_id uuid, copied_input_count integer, copied_brief jsonb)
language plpgsql
security definer
set search_path to ''
as $$
declare
  source_brand_id uuid;
  source_template_id text;
  source_brief jsonb;
  new_brand_id uuid;
  new_take_row_id uuid;
  copied_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source_take_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_new_take_id::text, 0));

  select take.brand_id, take.template_id, take.brief
    into source_brand_id, source_template_id, source_brief
  from public.takes take
  where take.id = p_source_take_id;
  if source_brand_id is null then
    raise exception 'Source Take was not found: %', p_source_take_id
      using errcode = '22023';
  end if;
  if source_template_id <> 'event-promo' then
    raise exception 'Source Take is not an event-promo Take: %', source_template_id
      using errcode = '22023';
  end if;

  select take.brand_id, take.id
    into new_brand_id, new_take_row_id
  from public.takes take
  where take.id = p_new_take_id;
  if new_take_row_id is null then
    raise exception 'Destination Take was not found: %', p_new_take_id
      using errcode = '22023';
  end if;
  if new_brand_id <> source_brand_id then
    raise exception 'Source and destination Takes belong to different brands.'
      using errcode = '42501';
  end if;

  update public.takes take
  set brief = source_brief,
      updated_at = now()
  where take.id = p_new_take_id;

  insert into public.take_inputs (take_id, material_id, role, checksum)
  select p_new_take_id,
         source_input.material_id,
         source_input.role,
         source_input.checksum
  from public.take_inputs source_input
  where source_input.take_id = p_source_take_id
  on conflict (take_id, material_id, role) do update
    set checksum = excluded.checksum;
  get diagnostics copied_count = row_count;

  return query
  select p_source_take_id,
         p_new_take_id,
         copied_count,
         source_brief;
end;
$$;

revoke all on function public.clone_event_promo_take(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.clone_event_promo_take(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Standalone logo intake: the placeholder Brand now lives in a workspace
--    org (the owner org, else the creator's personal org) instead of a
--    synthetic brand_organizations container.
-- ---------------------------------------------------------------------------

create or replace function private.ensure_logo_subject_entity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  creator_id uuid;
  target_org_id uuid;
  placeholder_brand_id uuid;
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
  target_org_id := coalesce(new.owner_org_id, private.ensure_personal_org(creator_id));

  select brand.id into placeholder_brand_id
  from public.brand_entities brand
  where brand.organization_id = target_org_id
    and brand.provenance ->> 'system_key' = 'unassigned_logo_brand'
  limit 1;

  if placeholder_brand_id is null then
    insert into public.brand_entities (
      name, status, source_kind, provenance, created_by,
      organization_id, brand_kind
    ) values (
      '未整理のブランドアセット', 'inferred', 'generated',
      jsonb_build_object('system_key', 'unassigned_logo_brand', 'reason', 'standalone_logo_without_subject'),
      creator_id, target_org_id, 'business'
    )
    returning id into placeholder_brand_id;
  end if;
  if placeholder_brand_id is null then
    raise exception 'Could not create a placeholder Brand for logo %', new.id;
  end if;

  new.subject_entity_id := placeholder_brand_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Account deletion: brands are counted and removed per workspace org.
-- ---------------------------------------------------------------------------

-- The parameter keeps its existing name: CREATE OR REPLACE cannot rename an
-- input parameter, and renaming it would mean dropping the function and
-- restoring its grants for no gain.
create or replace function private.account_deleted_brand_ids(p_user_id uuid, p_deleted_org_ids uuid[])
returns uuid[]
language sql
stable security definer
set search_path to ''
as $$
  select coalesce(array_agg(brand.id), '{}'::uuid[])
  from public.brand_entities brand
  where brand.organization_id = any(p_deleted_org_ids);
$$;

create or replace function public.delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  preview jsonb;
  deleted_org_ids uuid[] := '{}'::uuid[];
  deleted_brand_ids uuid[] := '{}'::uuid[];
  object_keys text[] := '{}'::text[];
  current_deletion_id uuid := gen_random_uuid();
begin
  preview := public.account_deletion_preview(p_user_id);
  if jsonb_array_length(preview -> 'blockingOrganizations') > 0 then
    raise exception 'ACCOUNT_DELETE_BLOCKED_LAST_ORG_OWNER'
      using errcode = '23514', detail = (preview -> 'blockingOrganizations')::text;
  end if;

  select coalesce(array_agg(m.org_id), '{}'::uuid[])
  into deleted_org_ids
  from public.org_members m
  where m.user_id = p_user_id
    and not exists (
      select 1 from public.org_members other
      where other.org_id = m.org_id and other.user_id <> p_user_id
    );

  deleted_brand_ids := private.account_deleted_brand_ids(p_user_id, deleted_org_ids);

  select coalesce(array_agg(object_key order by object_key), '{}'::text[])
  into object_keys
  from (
    select m.image_path as object_key
    from public.logo_mockups m
    join public.logo_candidates c on c.id = m.candidate_id
    join public.logos l on l.id = c.logo_id
    where (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and m.image_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select r.output_path
    from public.logo_asset_runs r
    join public.logo_candidates c on c.id = r.candidate_id
    join public.logos l on l.id = c.logo_id
    where r.output_path is not null
      and (l.owner_user_id = p_user_id or l.owner_org_id = any(deleted_org_ids))
      and r.output_path like ('logos/' || l.id || '/candidates/' || c.id::text || '/mockups/%')
    union
    select material.r2_key
    from public.brand_materials material
    where material.brand_id = any(deleted_brand_ids) and material.r2_key is not null
    union
    select artifact.r2_key
    from public.render_artifacts artifact
    join public.take_renders render on render.id = artifact.render_id
    join public.takes take on take.id = render.take_id
    where take.brand_id = any(deleted_brand_ids)
  ) paths
  where object_key is not null and object_key <> '';

  insert into private.r2_deletion_queue (deletion_id, object_key, user_id)
  select current_deletion_id, object_key, p_user_id
  from unnest(object_keys) as object_key
  on conflict do nothing;

  delete from public.takes where brand_id = any(deleted_brand_ids);
  delete from public.brand_materials where brand_id = any(deleted_brand_ids);

  delete from public.logos
  where owner_user_id = p_user_id
     or owner_org_id = any(deleted_org_ids);

  delete from public.logo_transfer_requests
  where proposed_owner_user_id = p_user_id
     or source_owner_user_id = p_user_id;

  -- Brands in the dying workspaces go before the workspaces themselves
  -- (organization_id is ON DELETE RESTRICT by design).
  delete from public.brand_entities where organization_id = any(deleted_org_ids);
  delete from public.organizations where org_id = any(deleted_org_ids);

  delete from public.users where user_id = p_user_id;
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'deletionId', current_deletion_id,
    'objectKeys', to_jsonb(object_keys),
    'preview', preview
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Retire the real-world container table and its access helpers. The
--    brand_entities policies were rewritten above, so nothing references
--    these functions anymore.
-- ---------------------------------------------------------------------------

drop table public.brand_organizations;
drop function if exists private.can_view_brand_organization(uuid);
drop function if exists private.can_manage_brand_organization(uuid);
drop function if exists private.enforce_organization_nesting();
drop function if exists private.organization_is_ancestor(uuid, uuid);

-- ---------------------------------------------------------------------------
-- 9. Sanity: fail loudly if the cutover left a contradiction behind.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.brand_organizations') is not null then
    raise exception 'v3 cutover incomplete: brand_organizations still exists.';
  end if;
  if to_regclass('public.works') is not null then
    raise exception 'v3 cutover incomplete: works still exists.';
  end if;
  if to_regprocedure('public.create_v2_take(uuid,uuid,text,text,integer,integer,jsonb,text,uuid,text,text,jsonb)') is null then
    raise exception 'v3 cutover incomplete: create_v2_take (v3 signature) is missing.';
  end if;
  if to_regprocedure('private.ensure_personal_org(uuid)') is null then
    raise exception 'v3 cutover incomplete: ensure_personal_org is missing.';
  end if;
  if to_regprocedure('public.ensure_my_workspace()') is null then
    raise exception 'v3 cutover incomplete: ensure_my_workspace is missing.';
  end if;
  -- Dropping a column takes its policies and triggers with it, so prove the
  -- rebuilt ones are back rather than trusting the order above.
  if (select count(*) from pg_policy
      where polrelid = 'public.brand_entities'::regclass) <> 4 then
    raise exception 'v3 cutover incomplete: brand_entities should have 4 policies.';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.brand_entities'::regclass
      and tgname = 'brand_entities_enforce_brand_membership'
  ) then
    raise exception 'v3 cutover incomplete: the brand membership trigger is missing.';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.brand_materials'::regclass
      and tgname = 'brand_materials_enforce_promotion'
  ) then
    raise exception 'v3 cutover incomplete: the material promotion trigger is missing.';
  end if;
end;
$$;

commit;
