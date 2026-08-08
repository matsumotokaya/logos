-- 0037 - avoid PL/pgSQL variable/column ambiguity in knowledge adoption

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
  v_field jsonb;
  v_field_path text;
  v_field_layer text;
  v_field_value jsonb;
  v_claim_id uuid;
  v_adopted_count integer := 0;
begin
  if jsonb_typeof(p_fields) <> 'array' or jsonb_array_length(p_fields) = 0 then
    raise exception 'At least one knowledge field is required.' using errcode = '22023';
  end if;
  if p_source_kind not in ('user_input', 'url_extraction', 'file_extraction') then
    raise exception 'Only explicit input or extraction may be adopted.' using errcode = '22023';
  end if;

  for v_field in select value from jsonb_array_elements(p_fields)
  loop
    v_field_path := v_field->>'field_path';
    v_field_layer := v_field->>'layer';
    v_field_value := v_field->'value';
    if v_field_path is null or v_field_layer not in ('fact', 'expression')
       or v_field_value is null or v_field_value = 'null'::jsonb then
      raise exception 'Invalid knowledge field.' using errcode = '22023';
    end if;

    insert into public.brand_knowledge_claims (
      brand_id, field_path, layer, value, confidence, source_kind,
      source_ref, observed_at, recorded_by
    ) values (
      p_brand_id,
      v_field_path,
      v_field_layer,
      v_field_value,
      case when v_field_layer = 'fact' then 'confirmed' else 'adopted' end,
      p_source_kind,
      coalesce(p_source_ref, '{}'::jsonb),
      now(),
      p_user_id
    )
    returning id into v_claim_id;

    insert into public.brand_knowledge_values (
      brand_id, field_path, layer, value, confidence, adopted_claim_id,
      decided_by, decided_at, updated_at
    ) values (
      p_brand_id,
      v_field_path,
      v_field_layer,
      v_field_value,
      case when v_field_layer = 'fact' then 'confirmed' else 'adopted' end,
      v_claim_id,
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

    v_adopted_count := v_adopted_count + 1;
  end loop;

  return v_adopted_count;
end;
$$;

revoke all on function public.adopt_brand_knowledge(
  uuid, jsonb, text, jsonb, uuid
) from public, anon;
grant execute on function public.adopt_brand_knowledge(
  uuid, jsonb, text, jsonb, uuid
) to authenticated, service_role;
