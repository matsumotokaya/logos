-- 0033 - qualify the take_renders columns used by create_v2_take
--
-- PostgreSQL exposes RETURNS TABLE column names as PL/pgSQL variables. The
-- unqualified `take_id` in 0032 was therefore ambiguous at runtime. Replacing
-- the function is sufficient; 0032's table changes and grants stay valid.

create or replace function public.create_v2_take(
  p_brand_id uuid,
  p_variant_id uuid,
  p_work_id uuid,
  p_tool_kind text,
  p_template_id text,
  p_template_version integer,
  p_brief_schema_version integer,
  p_brief jsonb,
  p_title text,
  p_created_by uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_renders jsonb
)
returns table (take_id uuid, render_ids uuid[], created boolean)
language plpgsql
set search_path = ''
as $$
declare
  target_take_id uuid;
  inserted boolean := false;
  existing_hash text;
  target_render_ids uuid[];
begin
  if jsonb_typeof(p_renders) <> 'array' or jsonb_array_length(p_renders) = 0 then
    raise exception 'At least one default render is required.' using errcode = '22023';
  end if;
  if (p_idempotency_key is null) <> (p_request_hash is null) then
    raise exception 'idempotency_key and request_hash must be supplied together.'
      using errcode = '22023';
  end if;

  insert into public.takes (
    brand_id, variant_id, work_id, tool_kind, template_id, template_version,
    brief_schema_version, brief, title, status, created_by,
    idempotency_key, request_hash
  ) values (
    p_brand_id, p_variant_id, p_work_id, p_tool_kind, p_template_id,
    p_template_version, p_brief_schema_version, p_brief, p_title, 'draft',
    p_created_by, p_idempotency_key, p_request_hash
  )
  on conflict (brand_id, template_id, idempotency_key) do nothing
  returning id into target_take_id;

  if target_take_id is not null then
    inserted := true;
  elsif p_idempotency_key is not null then
    select take.id, take.request_hash
      into target_take_id, existing_hash
    from public.takes as take
    where take.brand_id = p_brand_id
      and take.template_id = p_template_id
      and take.idempotency_key = p_idempotency_key;

    if target_take_id is null then
      raise exception 'Idempotent Take could not be resolved after conflict.';
    end if;
    if existing_hash is distinct from p_request_hash then
      raise exception 'Idempotency key was reused with different Take input.'
        using errcode = '22023';
    end if;
  else
    raise exception 'Take creation did not return an id.';
  end if;

  if inserted then
    insert into public.take_renders (
      take_id, locale, aspect_ratio, theme, format, status
    )
    select
      target_take_id,
      render.locale,
      render.aspect_ratio,
      coalesce(render.theme, ''),
      render.format,
      'pending'
    from jsonb_to_recordset(p_renders) as render(
      locale text,
      aspect_ratio text,
      theme text,
      format text
    );
  end if;

  select array_agg(render.id order by render.created_at, render.id)
    into target_render_ids
  from public.take_renders as render
  where render.take_id = target_take_id;

  if coalesce(array_length(target_render_ids, 1), 0) = 0 then
    raise exception 'Take has no render rows.';
  end if;

  return query select target_take_id, target_render_ids, inserted;
end;
$$;

revoke all on function public.create_v2_take(
  uuid, uuid, uuid, text, text, integer, integer, jsonb, text, uuid,
  text, text, jsonb
) from public, anon;
grant execute on function public.create_v2_take(
  uuid, uuid, uuid, text, text, integer, integer, jsonb, text, uuid,
  text, text, jsonb
) to authenticated, service_role;
