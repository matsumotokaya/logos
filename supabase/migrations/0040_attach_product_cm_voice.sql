-- ============================================================================
-- 0040 - atomically pin a Product CM voice material to its Take
--
-- R2 upload happens before this RPC. The database half is one transaction:
-- material registration, take_inputs pin and brief update either all land or
-- none do. A checksum-identical retry reuses the existing material.
-- ============================================================================

create or replace function public.attach_product_cm_voice(
  p_take_id uuid,
  p_material_id uuid,
  p_r2_key text,
  p_bytes bigint,
  p_checksum text,
  p_duration_ms integer,
  p_track jsonb,
  p_created_by uuid,
  p_source_ref jsonb default '{}'::jsonb
)
returns table (material_id uuid, created boolean)
language plpgsql
set search_path = ''
as $$
declare
  target_brand_id uuid;
  target_material_id uuid;
  inserted boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_take_id::text, 0));

  select take.brand_id
    into target_brand_id
  from public.takes take
  where take.id = p_take_id
    and take.template_id = 'product-cm';
  if target_brand_id is null then
    raise exception 'Product CM Take was not found.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_track) <> 'object' then
    raise exception 'Voice track must be an object.' using errcode = '22023';
  end if;
  if nullif(p_r2_key, '') is null or nullif(p_checksum, '') is null then
    raise exception 'Voice R2 key and checksum are required.' using errcode = '22023';
  end if;

  select material.id
    into target_material_id
  from public.take_inputs input
  join public.brand_materials material on material.id = input.material_id
  where input.take_id = p_take_id
    and input.role = 'product_cm_voice'
    and material.checksum = p_checksum
  order by material.created_at desc
  limit 1;

  if target_material_id is null then
    insert into public.brand_materials (
      id, scope, brand_id, take_id, kind, label, media_type, r2_key,
      bytes, checksum, duration_ms, source_kind, provenance, created_by
    ) values (
      p_material_id, 'take', target_brand_id, p_take_id, 'audio',
      'Product CM narration', 'audio/wav', p_r2_key,
      p_bytes, p_checksum, p_duration_ms, 'ai_generated',
      jsonb_build_object('role', 'product_cm_voice') || coalesce(p_source_ref, '{}'::jsonb),
      p_created_by
    )
    returning id into target_material_id;

    insert into public.take_inputs (take_id, material_id, role, checksum)
    values (p_take_id, target_material_id, 'product_cm_voice', p_checksum);
    inserted := true;
  end if;

  update public.takes take
  set brief = jsonb_set(
        take.brief,
        '{voice}',
        jsonb_build_object(
          'track', p_track,
          'audio', 'material:' || target_material_id::text
        ),
        true
      ),
      updated_at = now()
  where take.id = p_take_id;

  return query select target_material_id, inserted;
end;
$$;

revoke all on function public.attach_product_cm_voice(
  uuid, uuid, text, bigint, text, integer, jsonb, uuid, jsonb
) from public, anon;
grant execute on function public.attach_product_cm_voice(
  uuid, uuid, text, bigint, text, integer, jsonb, uuid, jsonb
) to authenticated, service_role;

select to_regprocedure(
  'public.attach_product_cm_voice(uuid,uuid,text,bigint,text,integer,jsonb,uuid,jsonb)'
) is not null as has_product_cm_voice_attachment;
