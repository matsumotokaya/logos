-- ============================================================================
-- 0047 - clone an event-promo Take as a starting point for a new one
--
-- The product is in the middle of designing how event-promo briefs are sourced.
-- Today the only authoritative brief lives on a Take that already has its
-- material slots filled through brand_materials + take_inputs, so the way to
-- make a new event video that actually renders is to start from that Take and
-- carry the inputs forward.
--
-- This RPC copies the source brief verbatim and pins every material the
-- source Take depends on to the new Take. It does not promote or recopy
-- materials: the bytes live in R2 and the existing brand_materials row
-- already has the same checksum, so re-using it keeps the brand library
-- small and the new Take pinned to the same content the user saw on the
-- template.
--
-- On a later pass this RPC will be superseded by a generic "clone template
-- Take" that also runs the asset-collection pipeline. For now the
-- event-promo scope matches what the product actually needs.
-- ============================================================================

create or replace function public.clone_event_promo_take(
  p_source_take_id uuid,
  p_new_take_id uuid,
  p_created_by uuid,
  p_work_id uuid default null
)
returns table (
  source_take_id uuid,
  new_take_id uuid,
  copied_input_count integer,
  copied_brief jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_brand_id uuid;
  source_template_id text;
  source_title text;
  source_brief jsonb;
  new_brand_id uuid;
  new_take_row_id uuid;
  copied_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_source_take_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_new_take_id::text, 0));

  -- Resolve the source Take. Both Take ids must already exist: the caller
  -- creates the destination Take with create_v2_take so that the template
  -- version and brief schema version are pinned exactly the way every other
  -- Take is. This RPC only carries the brief and the material pins.
  select take.brand_id, take.template_id, take.title, take.brief
    into source_brand_id, source_template_id, source_title, source_brief
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

  -- Carry the source brief forward verbatim. The destination Take was created
  -- with a placeholder empty brief; we overwrite it here so the new Take has
  -- the same authored content as its template.
  update public.takes take
  set brief = source_brief,
      updated_at = now()
  where take.id = p_new_take_id;

  -- Pin every material the source Take depends on. We trust the source's
  -- role labels rather than re-deriving them from the brief: the role is
  -- "event.logo.<slug>" etc, and the source Take is the only place those
  -- labels were assigned. A checksum-identical material at a narrower scope
  -- already pins to the same R2 bytes, so the new Take inherits the source's
  -- content without copying it.
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

  -- Optional work linkage. The caller passes the source's work id so the
  -- new Take shows up alongside the source under the same initiative.
  if p_work_id is not null then
    update public.takes take
    set work_id = p_work_id,
        updated_at = now()
    where take.id = p_new_take_id;
  end if;

  return query
  select p_source_take_id,
         p_new_take_id,
         copied_count,
         source_brief;
end;
$$;

revoke all on function public.clone_event_promo_take(
  uuid, uuid, uuid, uuid
) from public, anon;
grant execute on function public.clone_event_promo_take(
  uuid, uuid, uuid, uuid
) to authenticated, service_role;

select to_regprocedure(
  'public.clone_event_promo_take(uuid,uuid,uuid,uuid)'
) is not null as has_event_promo_clone_rpc;