-- ============================================================================
-- 0041 - make logo presentations canonical-slot-backed v2 Takes
--
-- The logo master remains the canonical asset. Editorial presentation state
-- lives in a version-pinned Take, and /p/<logoId> resolves that Take through
-- canonical_slots. These RPCs keep creation, editing and deletion atomic while
-- preserving logo-scoped collaboration permissions.
-- ============================================================================

create or replace function public.ensure_logo_presentation_take(p_logo_id text)
returns table (take_id uuid, render_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_brand_id uuid;
  target_title text;
  target_take_id uuid;
  target_render_id uuid;
  brief jsonb;
begin
  if actor_id is null or not private.can_admin_logo(p_logo_id) then
    raise exception 'LOGO_PRESENTATION_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('logo-presentation:' || p_logo_id, 0));

  select logo.subject_entity_id, logo.title
    into target_brand_id, target_title
  from public.logos logo
  where logo.id = p_logo_id;
  if target_brand_id is null then
    raise exception 'LOGO_PRESENTATION_REQUIRES_BRAND' using errcode = '23514';
  end if;

  select slot.take_id
    into target_take_id
  from public.canonical_slots slot
  where slot.logo_id = p_logo_id
    and slot.slot = 'logo_presentation';
  if target_take_id is not null then
    select render.id into target_render_id
    from public.take_renders render
    where render.take_id = target_take_id
      and render.format = 'html'
    order by render.created_at, render.id
    limit 1;
    return query select target_take_id, target_render_id, false;
    return;
  end if;

  if not exists (
    select 1 from public.template_versions template
    where template.template_id = 'logo-presentation'
      and template.version = 1
      and template.tool_kind = 'logo_presentation'
  ) then
    raise exception 'LOGO_PRESENTATION_TEMPLATE_MISSING' using errcode = '23503';
  end if;

  brief := jsonb_build_object(
    'logoId', p_logo_id,
    'presentation', jsonb_build_object(
      'catchphrase', '',
      'story', '',
      'sceneTexts', '{}'::jsonb,
      'layout', jsonb_build_object('version', 1, 'mappings', '[]'::jsonb),
      'updatedAt', now()::text
    )
  );

  insert into public.takes (
    brand_id, tool_kind, template_id, template_version,
    brief_schema_version, brief, title, status, created_by,
    idempotency_key, request_hash
  ) values (
    target_brand_id, 'logo_presentation', 'logo-presentation', 1,
    1, brief, target_title || ' ロゴプレゼンテーション', 'ready', actor_id,
    'logo-presentation:' || p_logo_id,
    md5(brief::text)
  )
  returning id into target_take_id;

  insert into public.take_renders (
    take_id, locale, aspect_ratio, theme, format, status
  ) values (
    target_take_id, 'und', 'responsive', '', 'html', 'ready'
  ) returning id into target_render_id;

  insert into public.canonical_slots (
    slot, logo_id, take_id, updated_by
  ) values (
    'logo_presentation', p_logo_id, target_take_id, actor_id
  );

  return query select target_take_id, target_render_id, true;
end;
$$;

create or replace function public.create_logo_with_presentation(
  p_logo_id text,
  p_title text,
  p_role text,
  p_visibility text,
  p_svg text,
  p_analysis jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_take_id uuid;
begin
  if actor_id is null then
    raise exception 'LOGO_CREATE_UNAUTHENTICATED' using errcode = '42501';
  end if;
  if nullif(p_title, '') is null or nullif(p_svg, '') is null then
    raise exception 'LOGO_CREATE_INVALID' using errcode = '22023';
  end if;

  insert into public.logos (
    id, owner_user_id, created_by, title, role, visibility, updated_by
  ) values (
    p_logo_id, actor_id, actor_id, p_title, p_role,
    p_visibility::public.logo_visibility, actor_id
  );

  insert into public.logo_candidates (
    logo_id, label, is_primary, svg, analysis
  ) values (
    p_logo_id, 'A', true, p_svg, p_analysis
  );

  insert into public.logo_activities (logo_id, user_id, action)
  values (p_logo_id, actor_id, 'created');

  select ensured.take_id into target_take_id
  from public.ensure_logo_presentation_take(p_logo_id) ensured;
  return target_take_id;
end;
$$;

create or replace function public.read_logo_presentation_take(p_logo_id text)
returns table (take_id uuid, presentation jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select take.id, take.brief -> 'presentation', take.updated_at
  from public.canonical_slots slot
  join public.takes take on take.id = slot.take_id
  where slot.logo_id = p_logo_id
    and slot.slot = 'logo_presentation'
    and take.template_id = 'logo-presentation'
    and private.can_view_logo(p_logo_id)
  limit 1;
$$;

create or replace function public.update_logo_presentation_take(
  p_logo_id text,
  p_presentation jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_take_id uuid;
begin
  if auth.uid() is null or not private.can_edit_logo_presentation(p_logo_id) then
    raise exception 'LOGO_PRESENTATION_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_presentation) <> 'object'
     or jsonb_typeof(p_presentation -> 'sceneTexts') <> 'object'
     or jsonb_typeof(p_presentation #> '{layout,mappings}') <> 'array' then
    raise exception 'LOGO_PRESENTATION_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('logo-presentation:' || p_logo_id, 0));

  select slot.take_id into target_take_id
  from public.canonical_slots slot
  join public.takes take on take.id = slot.take_id
  where slot.logo_id = p_logo_id
    and slot.slot = 'logo_presentation'
    and take.template_id = 'logo-presentation';
  if target_take_id is null then
    raise exception 'LOGO_PRESENTATION_TAKE_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.takes take
  set brief = jsonb_set(take.brief, '{presentation}', p_presentation, true),
      status = 'ready',
      updated_at = now()
  where take.id = target_take_id;

  update public.take_renders render
  set status = 'ready', updated_at = now()
  where render.take_id = target_take_id and render.format = 'html';

  insert into public.logo_activities (logo_id, user_id, action)
  values (p_logo_id, auth.uid(), 'presentation_updated');

  return target_take_id;
end;
$$;

create or replace function public.delete_logo_with_presentation(p_logo_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_take_id uuid;
begin
  if auth.uid() is null or not private.can_admin_logo(p_logo_id) then
    raise exception 'LOGO_DELETE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('logo-presentation:' || p_logo_id, 0));

  select slot.take_id into target_take_id
  from public.canonical_slots slot
  where slot.logo_id = p_logo_id and slot.slot = 'logo_presentation';

  if target_take_id is not null then
    delete from public.publications publication
    using public.take_renders render
    where publication.render_id = render.id and render.take_id = target_take_id;
    delete from public.canonical_slots
    where logo_id = p_logo_id and slot = 'logo_presentation';
    delete from public.takes where id = target_take_id;
  end if;
  delete from public.logos where id = p_logo_id;
  return found;
end;
$$;

revoke all on function public.ensure_logo_presentation_take(text)
  from public, anon;
revoke all on function public.create_logo_with_presentation(
  text, text, text, text, text, jsonb
) from public, anon;
revoke all on function public.read_logo_presentation_take(text)
  from public, anon;
revoke all on function public.update_logo_presentation_take(text, jsonb)
  from public, anon;
revoke all on function public.delete_logo_with_presentation(text)
  from public, anon;
grant execute on function public.ensure_logo_presentation_take(text) to authenticated, service_role;
grant execute on function public.create_logo_with_presentation(
  text, text, text, text, text, jsonb
) to authenticated, service_role;
grant execute on function public.read_logo_presentation_take(text) to authenticated, service_role;
grant execute on function public.update_logo_presentation_take(text, jsonb) to authenticated, service_role;
grant execute on function public.delete_logo_with_presentation(text) to authenticated, service_role;

select
  to_regprocedure('public.ensure_logo_presentation_take(text)') is not null
    as has_logo_presentation_create,
  to_regprocedure('public.create_logo_with_presentation(text,text,text,text,text,jsonb)') is not null
    as has_atomic_logo_create,
  to_regprocedure('public.read_logo_presentation_take(text)') is not null
    as has_logo_presentation_read,
  to_regprocedure('public.update_logo_presentation_take(text,jsonb)') is not null
    as has_logo_presentation_update,
  to_regprocedure('public.delete_logo_with_presentation(text)') is not null
    as has_logo_presentation_delete;
