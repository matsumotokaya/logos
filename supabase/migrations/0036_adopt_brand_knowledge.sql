-- ============================================================================
-- 0036 - one atomic write path for explicitly adopted BrandKnowledge
--
-- Design: docs/schema-v2.md §7.2 / §19.4 V2-3
--
-- Generation may append claims but cannot call this from the app. Brand core
-- editors use this function to append the user's new claim and adopt that exact
-- claim as the canonical value in the same transaction.
-- ============================================================================

create or replace function public.adopt_brand_knowledge(
  p_brand_id uuid,
  p_fields jsonb,
  p_source_kind text,
  p_source_ref jsonb,
  p_user_id uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  field jsonb;
  field_path text;
  field_layer text;
  field_value jsonb;
  claim_id uuid;
  adopted_count integer := 0;
begin
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) = 0 then
    raise exception 'At least one knowledge field is required.' using errcode = '22023';
  end if;
  if p_source_kind not in ('user_input', 'url_extraction', 'file_extraction') then
    raise exception 'Only explicit input or extraction may be adopted.' using errcode = '22023';
  end if;

  for field in select value from jsonb_array_elements(p_fields)
  loop
    field_path := field->>'field_path';
    field_layer := field->>'layer';
    field_value := field->'value';
    if field_path is null or field_layer not in ('fact', 'expression')
       or field_value is null or field_value = 'null'::jsonb then
      raise exception 'Invalid knowledge field.' using errcode = '22023';
    end if;

    insert into public.brand_knowledge_claims (
      brand_id, field_path, layer, value, confidence, source_kind,
      source_ref, observed_at, recorded_by
    ) values (
      p_brand_id,
      field_path,
      field_layer,
      field_value,
      case when field_layer = 'fact' then 'confirmed' else 'adopted' end,
      p_source_kind,
      coalesce(p_source_ref, '{}'::jsonb),
      now(),
      p_user_id
    )
    returning id into claim_id;

    insert into public.brand_knowledge_values (
      brand_id, field_path, layer, value, confidence, adopted_claim_id,
      decided_by, decided_at, updated_at
    ) values (
      p_brand_id,
      field_path,
      field_layer,
      field_value,
      case when field_layer = 'fact' then 'confirmed' else 'adopted' end,
      claim_id,
      p_user_id,
      now(),
      now()
    )
    on conflict (brand_id, field_path) where variant_id is null
    do update set
      layer = excluded.layer,
      value = excluded.value,
      confidence = excluded.confidence,
      adopted_claim_id = excluded.adopted_claim_id,
      decided_by = excluded.decided_by,
      decided_at = excluded.decided_at,
      updated_at = excluded.updated_at;

    adopted_count := adopted_count + 1;
  end loop;

  return adopted_count;
end;
$$;

revoke all on function public.adopt_brand_knowledge(
  uuid, jsonb, text, jsonb, uuid
) from public, anon;
grant execute on function public.adopt_brand_knowledge(
  uuid, jsonb, text, jsonb, uuid
) to authenticated, service_role;

select to_regprocedure(
  'public.adopt_brand_knowledge(uuid,jsonb,text,jsonb,uuid)'
) is not null as has_adopt_knowledge;
