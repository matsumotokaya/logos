-- ============================================================================
-- 0027 - Run (one pipeline execution), Render (one output unit), Artifact (a file)
--
-- Design: docs/schema-v2.md §11
--
--   take_runs        collect / extract / structure / render / publish, one row
--                    per execution. Holds the inputs, the cost and the error.
--                    Closed to viewers: it carries source URLs and API spend.
--   take_renders     locale x aspect ratio x theme x format. This is where the
--                    combinations live, so a take stays one row.
--   render_artifacts the actual object in R2. An artifact is NOT a material —
--                    it becomes one only through explicit promotion (0028), and
--                    then both rows point at the same bytes.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- Run -------------------------------------------------------------

create table if not exists public.take_runs (
  id              uuid primary key default gen_random_uuid(),
  take_id         uuid not null references public.takes(id) on delete cascade,
  stage           text not null check (stage in
                    ('collect','extract','structure','render','publish')),
  status          text not null default 'queued' check (status in
                    ('queued','running','succeeded','failed','canceled')),
  input           jsonb not null default '{}'::jsonb,
  steps           jsonb not null default '[]'::jsonb,
  usage           jsonb not null default '{}'::jsonb,
  external_job_id uuid unique,
  error_message   text,
  triggered_by    uuid references public.users(user_id) on delete set null,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.take_runs enable row level security;

create index if not exists take_runs_take_created_idx
  on public.take_runs (take_id, created_at desc);
create index if not exists take_runs_queue_idx
  on public.take_runs (status, started_at)
  where status in ('queued','running');

comment on table public.take_runs is
  'Private execution history: inputs, steps, token/render usage and errors. Not visible at the view rung.';
comment on column public.take_runs.usage is
  'Cost of this execution. Billing is not designed yet (free for now), but the record starts here so a credit check has one place to live.';
comment on column public.take_runs.external_job_id is
  'Bridge to the campaign job store while the product-cm pipeline remains the one implementation.';

-- ---------- Render ----------------------------------------------------------

create table if not exists public.take_renders (
  id                 uuid primary key default gen_random_uuid(),
  take_id            uuid not null references public.takes(id) on delete cascade,
  locale             text not null default 'ja',
  aspect_ratio       text not null default '16:9',
  theme              text not null default '',
  format             text not null check (format in
                       ('mp4','html','png','pdf','svg','wav')),
  params             jsonb not null default '{}'::jsonb,
  status             text not null default 'pending' check (status in
                       ('pending','running','ready','failed','stale')),
  latest_artifact_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- theme defaults to '' rather than NULL so this uniqueness actually holds
  -- (NULLs would let the same combination be inserted repeatedly).
  unique (take_id, locale, aspect_ratio, theme, format)
);
alter table public.take_renders enable row level security;

create index if not exists take_renders_take_idx
  on public.take_renders (take_id, created_at desc);

comment on table public.take_renders is
  'One output unit of a take: locale, aspect ratio, theme and format. Publication targets a render, not a take.';
comment on column public.take_renders.status is
  'stale means a newer template version exists and this output was deliberately NOT re-rendered without consent.';

-- ---------- Artifact --------------------------------------------------------

create table if not exists public.render_artifacts (
  id          uuid primary key default gen_random_uuid(),
  render_id   uuid not null references public.take_renders(id) on delete cascade,
  run_id      uuid references public.take_runs(id) on delete set null,
  r2_key      text not null,
  media_type  text not null,
  bytes       bigint,
  checksum    text,
  width       integer,
  height      integer,
  duration_ms integer,
  status      text not null default 'ready'
              check (status in ('ready','failed','archived')),
  created_at  timestamptz not null default now()
);
alter table public.render_artifacts enable row level security;

create index if not exists render_artifacts_render_created_idx
  on public.render_artifacts (render_id, created_at desc);
create index if not exists render_artifacts_r2_key_idx
  on public.render_artifacts (r2_key);

do $$ begin
  alter table public.take_renders
    add constraint take_renders_latest_artifact_fkey
    foreign key (latest_artifact_id)
    references public.render_artifacts(id) on delete set null;
exception when duplicate_object then null; end $$;

comment on table public.render_artifacts is
  'A rendered file in R2. Keys follow brands/<brandId>/takes/<takeId>/renders/<renderId>/<name>; R2 is the only source of truth.';
comment on column public.render_artifacts.r2_key is
  'A promoted material may point at this same key. Deleting the object requires the reference count across both tables to be zero.';

-- ---------- helper used by artifact policies --------------------------------

create or replace function private.render_brand_id(p_render_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select take.brand_id
  from public.take_renders render
  join public.takes take on take.id = render.take_id
  where render.id = p_render_id;
$$;

revoke all on function private.render_brand_id(uuid) from public, anon, authenticated;
grant execute on function private.render_brand_id(uuid) to authenticated;

-- ---------- policies --------------------------------------------------------

drop policy if exists take_runs_select on public.take_runs;
create policy take_runs_select on public.take_runs
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  );

drop policy if exists take_runs_insert on public.take_runs;
create policy take_runs_insert on public.take_runs
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
    and (triggered_by is null or triggered_by = auth.uid())
  );

drop policy if exists take_runs_update on public.take_runs;
create policy take_runs_update on public.take_runs
  for update to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  )
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  );

drop policy if exists take_runs_delete on public.take_runs;
create policy take_runs_delete on public.take_runs
  for delete to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  );

drop policy if exists take_renders_select on public.take_renders;
create policy take_renders_select on public.take_renders
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_brand_entity(private.take_brand_id(take_id))
  );

drop policy if exists take_renders_write on public.take_renders;
create policy take_renders_write on public.take_renders
  for all to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  )
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(private.take_brand_id(take_id))
  );

drop policy if exists render_artifacts_select on public.render_artifacts;
create policy render_artifacts_select on public.render_artifacts
  for select to authenticated
  using (
    private.is_registered_user()
    and private.can_view_brand_entity(private.render_brand_id(render_id))
  );

drop policy if exists render_artifacts_write on public.render_artifacts;
create policy render_artifacts_write on public.render_artifacts
  for all to authenticated
  using (
    private.is_registered_user()
    and private.can_edit_brand_output(private.render_brand_id(render_id))
  )
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(private.render_brand_id(render_id))
  );

-- ---------- verification ---------------------------------------------------

select
  to_regclass('public.take_runs') is not null as has_take_runs,
  to_regclass('public.take_renders') is not null as has_take_renders,
  to_regclass('public.render_artifacts') is not null as has_render_artifacts,
  to_regprocedure('private.render_brand_id(uuid)') is not null as has_render_brand_helper,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'take_runs' and 'anon' = any(roles)
  ) as runs_closed_to_anon;
