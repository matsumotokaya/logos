-- Create a logo directly under an existing Brand while keeping the logo
-- master and its canonical V2 presentation Take in one transaction.

create or replace function public.create_brand_logo_with_presentation(
  p_brand_id uuid,
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
    raise exception 'BRAND_LOGO_CREATE_UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_brand_id is null or not private.can_manage_brand_entity(p_brand_id) then
    raise exception 'BRAND_LOGO_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(p_logo_id), '') is null
     or nullif(btrim(p_title), '') is null
     or nullif(btrim(p_svg), '') is null
     or p_role not in ('brand', 'corporate', 'service', 'subsidiary', 'other')
     or p_visibility not in ('draft', 'private', 'unlisted', 'public')
     or p_analysis is null
     or jsonb_typeof(p_analysis) <> 'object' then
    raise exception 'BRAND_LOGO_CREATE_INVALID' using errcode = '22023';
  end if;

  insert into public.logos (
    id, owner_user_id, created_by, title, role, visibility,
    subject_entity_id, updated_by
  ) values (
    btrim(p_logo_id), actor_id, actor_id, btrim(p_title), p_role,
    p_visibility::public.logo_visibility, p_brand_id, actor_id
  );

  insert into public.logo_candidates (
    logo_id, label, is_primary, svg, analysis
  ) values (
    btrim(p_logo_id), 'A', true, p_svg, p_analysis
  );

  insert into public.logo_activities (logo_id, user_id, action)
  values (btrim(p_logo_id), actor_id, 'created');

  select ensured.take_id into target_take_id
  from public.ensure_logo_presentation_take(btrim(p_logo_id)) ensured;

  return target_take_id;
end;
$$;

revoke all on function public.create_brand_logo_with_presentation(
  uuid, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.create_brand_logo_with_presentation(
  uuid, text, text, text, text, text, jsonb
) to authenticated, service_role;

do $$
begin
  if to_regprocedure(
    'public.create_brand_logo_with_presentation(uuid,text,text,text,text,text,jsonb)'
  ) is null then
    raise exception 'Existing-Brand logo creation RPC is missing.';
  end if;
  if has_function_privilege(
    'anon',
    'public.create_brand_logo_with_presentation(uuid,text,text,text,text,text,jsonb)',
    'execute'
  ) then
    raise exception 'Anonymous users must not create Brand logos.';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.create_brand_logo_with_presentation(uuid,text,text,text,text,text,jsonb)',
    'execute'
  ) then
    raise exception 'Authenticated Brand managers must be able to create logos.';
  end if;
end;
$$;
