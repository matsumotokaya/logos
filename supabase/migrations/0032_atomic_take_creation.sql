-- ============================================================================
-- 0032 - atomic and idempotent Take creation
--
-- Design: docs/schema-v2.md §19.1 / §19.4 V2-1
--
-- A Take without its declared default Renders is not a valid product state.
-- The original application path inserted those rows in two requests, leaving
-- an orphan Take when the second request failed. This RPC makes the operation
-- one transaction and gives external pipelines a stable retry key.
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.takes
  add column if not exists idempotency_key text,
  add column if not exists request_hash text;

do $$ begin
  alter table public.takes
    add constraint takes_idempotency_pair_check
    check ((idempotency_key is null) = (request_hash is null));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.takes
    add constraint takes_idempotency_uq
    unique (brand_id, template_id, idempotency_key);
exception when duplicate_object then null; end $$;

comment on column public.takes.idempotency_key is
  'Stable caller key for retrying one logical Take creation. NULL means the caller explicitly wants a new Take.';
comment on column public.takes.request_hash is
  'Hash of the immutable creation request. Reusing a key for different input is refused.';

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
    select id, request_hash
      into target_take_id, existing_hash
    from public.takes
    where brand_id = p_brand_id
      and template_id = p_template_id
      and idempotency_key = p_idempotency_key;

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

  select array_agg(id order by created_at, id)
    into target_render_ids
  from public.take_renders
  where take_id = target_take_id;

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

select
  to_regprocedure(
    'public.create_v2_take(uuid,uuid,uuid,text,text,integer,integer,jsonb,text,uuid,text,text,jsonb)'
  ) is not null as has_atomic_take_creation,
  exists (
    select 1 from pg_constraint
    where conname = 'takes_idempotency_uq'
      and conrelid = 'public.takes'::regclass
  ) as has_take_idempotency;
