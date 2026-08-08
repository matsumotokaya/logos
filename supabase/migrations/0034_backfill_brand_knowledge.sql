-- ============================================================================
-- 0034 - backfill legacy brand_profiles into BrandKnowledge
--
-- Design: docs/schema-v2.md §7 / §19.4 V2-3
--
-- Existing profiles remain readable during the compatibility window. Each
-- non-null legacy leaf becomes one migration claim and, only when no explicit
-- value already exists, one adopted value. Re-running adds nothing.
-- ============================================================================

with mapped as (
  select distinct on (profile.entity_id, field.field_path)
    profile.entity_id as brand_id,
    field.field_path,
    field.layer,
    field.value,
    profile.status,
    profile.created_by,
    field.priority
  from public.brand_profiles as profile
  cross join lateral (
    values
      ('identity.legal_name', 'fact', profile.profile #> '{organization,name}', 20),
      ('identity.description', 'fact', profile.profile #> '{organization,description}', 20),
      ('identity.organization_kind', 'fact', profile.profile #> '{organization,organization_kind}', 20),
      ('identity.relationship', 'fact', profile.profile #> '{organization,relationship}', 20),
      ('contact.website', 'fact', profile.profile #> '{service,url}', 10),
      ('contact.website', 'fact', profile.profile #> '{organization,website}', 20),
      ('offering.name', 'fact', profile.profile #> '{service,name}', 10),
      ('offering.tagline', 'fact', profile.profile #> '{service,tagline}', 10),
      ('offering.description', 'fact', profile.profile #> '{service,description}', 10),
      ('offering.industry', 'fact', profile.profile #> '{service,industry}', 10),
      ('offering.business_type', 'fact', profile.profile #> '{service,business_type}', 10),
      ('offering.audience', 'fact', profile.profile #> '{service,audience}', 10),
      ('offering.summary', 'fact', profile.profile #> '{service,offering}', 10),
      ('palette.primary', 'expression', profile.profile #> '{palette,primary}', 10),
      ('palette.accent', 'expression', profile.profile #> '{palette,accent}', 10),
      ('palette.background', 'expression', profile.profile #> '{palette,background}', 10),
      ('palette.surface', 'expression', profile.profile #> '{palette,surface}', 10),
      ('palette.text', 'expression', profile.profile #> '{palette,text}', 10),
      ('palette.mode', 'expression', profile.profile #> '{palette,mode}', 10),
      ('palette.source', 'expression', profile.profile #> '{palette,palette_source}', 10),
      ('typography.font_style', 'expression', profile.profile #> '{palette,font_style}', 10),
      ('typography.body_font', 'expression', profile.profile #> '{design_tokens,body_font}', 10),
      ('typography.heading_font', 'expression', profile.profile #> '{design_tokens,heading_font}', 10),
      ('tokens.button_radius', 'expression', profile.profile #> '{design_tokens,button_radius}', 10),
      ('tokens.button_padding', 'expression', profile.profile #> '{design_tokens,button_padding}', 10),
      ('tokens.section_spacing', 'expression', profile.profile #> '{design_tokens,section_spacing}', 10),
      ('tokens.container_width', 'expression', profile.profile #> '{design_tokens,container_width}', 10),
      ('tone.theme', 'expression', profile.profile -> 'theme', 10)
  ) as field(field_path, layer, value, priority)
  where field.value is not null
    and field.value <> 'null'::jsonb
    and not (jsonb_typeof(field.value) = 'string' and field.value = '""'::jsonb)
  order by profile.entity_id, field.field_path, field.priority
), inserted_claims as (
  insert into public.brand_knowledge_claims (
    brand_id, field_path, layer, value, confidence, source_kind,
    source_ref, observed_at, recorded_by
  )
  select
    mapped.brand_id,
    mapped.field_path,
    mapped.layer,
    mapped.value,
    case
      when mapped.layer = 'expression' then 'suggested'
      when mapped.status = 'confirmed' then 'confirmed'
      else 'inferred'
    end,
    'derived',
    jsonb_build_object(
      'migrated_from', 'brand_profiles',
      'entity_id', mapped.brand_id,
      'field_path', mapped.field_path
    ),
    now(),
    mapped.created_by
  from mapped
  where not exists (
    select 1
    from public.brand_knowledge_claims as claim
    where claim.brand_id = mapped.brand_id
      and claim.variant_id is null
      and claim.field_path = mapped.field_path
      and claim.source_ref @> jsonb_build_object(
        'migrated_from', 'brand_profiles',
        'entity_id', mapped.brand_id,
        'field_path', mapped.field_path
      )
  )
  returning id
)
insert into public.brand_knowledge_values (
  brand_id, field_path, layer, value, confidence, adopted_claim_id,
  decided_by, decided_at, updated_at
)
select
  mapped.brand_id,
  mapped.field_path,
  mapped.layer,
  mapped.value,
  case
    when mapped.layer = 'expression' then 'adopted'
    when mapped.status = 'confirmed' then 'confirmed'
    else 'inferred'
  end,
  claim.id,
  mapped.created_by,
  now(),
  now()
from mapped
join public.brand_knowledge_claims as claim
  on claim.brand_id = mapped.brand_id
 and claim.variant_id is null
 and claim.field_path = mapped.field_path
 and claim.source_ref @> jsonb_build_object(
   'migrated_from', 'brand_profiles',
   'entity_id', mapped.brand_id,
   'field_path', mapped.field_path
 )
where not exists (
  select 1
  from public.brand_knowledge_values as existing
  where existing.brand_id = mapped.brand_id
    and existing.variant_id is null
    and existing.field_path = mapped.field_path
);

select
  count(*) filter (
    where source_ref @> '{"migrated_from":"brand_profiles"}'::jsonb
  ) as migrated_claims
from public.brand_knowledge_claims;
