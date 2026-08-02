-- ============================================================================
-- 0020 - guarantee a placeholder Organization → Business for standalone logos
--
-- Campaign intake already creates its hierarchy explicitly. Legacy and direct
-- logo uploads may not have a subject yet, so keep them inside a reversible,
-- clearly inferred holding hierarchy instead of leaving them unassigned.
-- ============================================================================

create unique index if not exists brand_entities_personal_placeholder_org_uq
  on public.brand_entities (created_by)
  where entity_type = 'organization'
    and linked_org_id is null
    and provenance ->> 'system_key' = 'unassigned_logo_organization';

create unique index if not exists brand_entities_workspace_placeholder_org_uq
  on public.brand_entities (linked_org_id)
  where entity_type = 'organization'
    and linked_org_id is not null
    and provenance ->> 'system_key' = 'unassigned_logo_organization';

create unique index if not exists brand_entities_placeholder_business_uq
  on public.brand_entities (parent_entity_id)
  where entity_type = 'business'
    and provenance ->> 'system_key' = 'unassigned_logo_business';

create or replace function private.ensure_logo_subject_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  placeholder_organization_id uuid;
  placeholder_business_id uuid;
  creator_id uuid;
begin
  if new.subject_entity_id is not null then
    return new;
  end if;

  creator_id := coalesce(new.created_by, new.owner_user_id);

  if new.owner_org_id is not null then
    select entity.id
      into placeholder_organization_id
    from public.brand_entities entity
    where entity.entity_type = 'organization'
      and entity.linked_org_id = new.owner_org_id
      and entity.provenance ->> 'system_key' = 'unassigned_logo_organization'
    limit 1;

    if placeholder_organization_id is null then
      insert into public.brand_entities (
        name,
        entity_type,
        organization_kind,
        linked_org_id,
        status,
        source_kind,
        provenance,
        created_by
      ) values (
        '名称未設定のOrganization',
        'organization',
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
        where entity_type = 'organization'
          and linked_org_id is not null
          and provenance ->> 'system_key' = 'unassigned_logo_organization'
      do nothing
      returning id into placeholder_organization_id;

      if placeholder_organization_id is null then
        select entity.id
          into placeholder_organization_id
        from public.brand_entities entity
        where entity.entity_type = 'organization'
          and entity.linked_org_id = new.owner_org_id
          and entity.provenance ->> 'system_key' = 'unassigned_logo_organization'
        limit 1;
      end if;
    end if;
  else
    select entity.id
      into placeholder_organization_id
    from public.brand_entities entity
    where entity.entity_type = 'organization'
      and entity.linked_org_id is null
      and entity.created_by = new.owner_user_id
      and entity.provenance ->> 'system_key' = 'unassigned_logo_organization'
    limit 1;

    if placeholder_organization_id is null then
      insert into public.brand_entities (
        name,
        entity_type,
        organization_kind,
        status,
        source_kind,
        provenance,
        created_by
      ) values (
        '名称未設定のOrganization',
        'organization',
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
        where entity_type = 'organization'
          and linked_org_id is null
          and provenance ->> 'system_key' = 'unassigned_logo_organization'
      do nothing
      returning id into placeholder_organization_id;

      if placeholder_organization_id is null then
        select entity.id
          into placeholder_organization_id
        from public.brand_entities entity
        where entity.entity_type = 'organization'
          and entity.linked_org_id is null
          and entity.created_by = new.owner_user_id
          and entity.provenance ->> 'system_key' = 'unassigned_logo_organization'
        limit 1;
      end if;
    end if;
  end if;

  if placeholder_organization_id is null then
    raise exception 'Could not create a placeholder Organization for logo %', new.id;
  end if;

  select entity.id
    into placeholder_business_id
  from public.brand_entities entity
  where entity.entity_type = 'business'
    and entity.parent_entity_id = placeholder_organization_id
    and entity.provenance ->> 'system_key' = 'unassigned_logo_business'
  limit 1;

  if placeholder_business_id is null then
    insert into public.brand_entities (
      name,
      entity_type,
      parent_entity_id,
      status,
      source_kind,
      provenance,
      created_by
    ) values (
      '未整理のブランドアセット',
      'business',
      placeholder_organization_id,
      'inferred',
      'generated',
      jsonb_build_object(
        'system_key', 'unassigned_logo_business',
        'reason', 'standalone_logo_without_subject'
      ),
      creator_id
    )
    on conflict (parent_entity_id)
      where entity_type = 'business'
        and provenance ->> 'system_key' = 'unassigned_logo_business'
    do nothing
    returning id into placeholder_business_id;

    if placeholder_business_id is null then
      select entity.id
        into placeholder_business_id
      from public.brand_entities entity
      where entity.entity_type = 'business'
        and entity.parent_entity_id = placeholder_organization_id
        and entity.provenance ->> 'system_key' = 'unassigned_logo_business'
      limit 1;
    end if;
  end if;

  if placeholder_business_id is null then
    raise exception 'Could not create a placeholder Business for logo %', new.id;
  end if;

  new.subject_entity_id := placeholder_business_id;
  return new;
end;
$$;

revoke all on function private.ensure_logo_subject_entity() from public;
grant execute on function private.ensure_logo_subject_entity() to service_role;

drop trigger if exists logos_ensure_subject_entity on public.logos;
create trigger logos_ensure_subject_entity
  before insert or update of subject_entity_id, owner_user_id, owner_org_id
  on public.logos
  for each row
  execute function private.ensure_logo_subject_entity();

-- Fire the trigger for legacy rows. The trigger replaces NULL before storage.
update public.logos
set subject_entity_id = null
where subject_entity_id is null;

comment on function private.ensure_logo_subject_entity() is
  'Assigns subject-less logos to an inferred Organization → Business holding hierarchy owned by the same account/workspace.';
