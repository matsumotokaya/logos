-- ============================================================================
-- 0048 - atomically pin a narration voice to any narrated Take
--
-- 0040 did this for product-cm and only product-cm: it matched
-- `template_id = 'product-cm'` and wrote the pin under the fixed role
-- 'product_cm_voice'. The work it does is not template-specific — register the
-- WAV as a take-scoped material, pin it through take_inputs, and point the
-- brief's voice slot at it — so a second narrated template (event-cm) could
-- not reach any of it.
--
-- This is that function with the two hardcoded values lifted out: the template
-- is checked for being a video rather than for being one particular template,
-- and the pin role is a parameter. Everything else is unchanged, including the
-- contract that R2 upload happens BEFORE this call and that a
-- checksum-identical retry reuses the existing material.
--
-- 0040's function is deliberately left in place: product-cm Takes were created
-- against it, and removing a working entry point to prove a point about
-- duplication is not worth the risk. New callers use this one.
-- ============================================================================

create or replace function public.attach_take_narration(
  p_take_id uuid,
  p_material_id uuid,
  p_r2_key text,
  p_bytes bigint,
  p_checksum text,
  p_duration_ms integer,
  p_track jsonb,
  p_created_by uuid,
  p_role text default 'narration',
  p_label text default 'Narration',
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
    and take.tool_kind = 'video';
  if target_brand_id is null then
    raise exception 'Narrated video Take was not found.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_track) <> 'object' then
    raise exception 'Voice track must be an object.' using errcode = '22023';
  end if;
  if nullif(p_r2_key, '') is null or nullif(p_checksum, '') is null then
    raise exception 'Voice R2 key and checksum are required.' using errcode = '22023';
  end if;
  if nullif(p_role, '') is null then
    raise exception 'Pin role is required.' using errcode = '22023';
  end if;

  -- Same bytes pinned under the same role on the same take: reuse. This is
  -- what makes a retry after a network failure safe.
  select material.id
    into target_material_id
  from public.take_inputs input
  join public.brand_materials material on material.id = input.material_id
  where input.take_id = p_take_id
    and input.role = p_role
    and material.checksum = p_checksum
  order by material.created_at desc
  limit 1;

  if target_material_id is null then
    insert into public.brand_materials (
      id, scope, brand_id, take_id, kind, label, media_type, r2_key,
      bytes, checksum, duration_ms, source_kind, provenance, created_by
    ) values (
      p_material_id, 'take', target_brand_id, p_take_id, 'audio',
      p_label, 'audio/wav', p_r2_key,
      p_bytes, p_checksum, p_duration_ms, 'ai_generated',
      jsonb_build_object('role', p_role) || coalesce(p_source_ref, '{}'::jsonb),
      p_created_by
    )
    returning id into target_material_id;

    insert into public.take_inputs (take_id, material_id, role, checksum)
    values (p_take_id, target_material_id, p_role, p_checksum);
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

revoke all on function public.attach_take_narration(
  uuid, uuid, text, bigint, text, integer, jsonb, uuid, text, text, jsonb
) from public, anon;
grant execute on function public.attach_take_narration(
  uuid, uuid, text, bigint, text, integer, jsonb, uuid, text, text, jsonb
) to authenticated, service_role;

select to_regprocedure(
  'public.attach_take_narration(uuid,uuid,text,bigint,text,integer,jsonb,uuid,text,text,jsonb)'
) is not null as has_take_narration_attachment;
