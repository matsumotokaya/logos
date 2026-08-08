-- The preserved WealthPark Organization needs its primary corporate Brand.
-- Organization detail, profile and corporate-logo ownership resolve through
-- this Brand; keeping only WealthPark Lab violated that final-model invariant.
with target_organization as (
  select organization.*
  from public.brand_organizations organization
  where organization.name = 'WealthPark'
), inserted as (
  insert into public.brand_entities (
    name,
    linked_org_id,
    website,
    industry,
    location,
    description,
    created_by,
    status,
    source_kind,
    provenance,
    brand_organization_id,
    brand_kind,
    parent_brand_id,
    is_primary_brand
  )
  select
    organization.name,
    organization.linked_org_id,
    organization.website,
    organization.industry,
    organization.location,
    organization.description,
    organization.created_by,
    organization.status,
    organization.source_kind,
    organization.provenance || jsonb_build_object(
      'system_key', 'primary_corporate_brand',
      'restored_by', '0045_restore_preserved_organization_primary_brand'
    ),
    organization.id,
    'corporate',
    null,
    true
  from target_organization organization
  where not exists (
    select 1
    from public.brand_entities brand
    where brand.brand_organization_id = organization.id
      and brand.brand_kind = 'corporate'
      and brand.is_primary_brand
  )
  returning id, brand_organization_id
), primary_brand as (
  select id, brand_organization_id from inserted
  union all
  select brand.id, brand.brand_organization_id
  from public.brand_entities brand
  join target_organization organization
    on organization.id = brand.brand_organization_id
  where brand.brand_kind = 'corporate'
    and brand.is_primary_brand
  limit 1
)
update public.brand_entities child
set parent_brand_id = primary_brand.id,
    updated_at = now()
from primary_brand
where child.brand_organization_id = primary_brand.brand_organization_id
  and child.brand_kind = 'business'
  and child.id <> primary_brand.id
  and child.parent_brand_id is distinct from primary_brand.id;

do $$
begin
  if (
    select count(*)
    from public.brand_organizations organization
    join public.brand_entities brand
      on brand.brand_organization_id = organization.id
    where organization.name = 'WealthPark'
      and brand.brand_kind = 'corporate'
      and brand.is_primary_brand
  ) <> 1 then
    raise exception 'WealthPark must have exactly one primary corporate Brand.';
  end if;
end;
$$;
