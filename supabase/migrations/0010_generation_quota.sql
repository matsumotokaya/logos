-- 0010_generation_quota.sql
-- Per-user quota ledger for paid AI generation (/api/generate).
-- The API records one row per attempt BEFORE calling the provider, so failed
-- provider calls also consume quota (this is cost control, not analytics).
-- Idempotent; safe to re-run.

create table if not exists public.generation_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references public.users(user_id) on delete cascade,
  target     text not null,
  created_at timestamptz not null default now()
);

create index if not exists generation_events_user_created_idx
  on public.generation_events (user_id, created_at desc);

alter table public.generation_events enable row level security;

drop policy if exists generation_events_insert_own on public.generation_events;
create policy generation_events_insert_own on public.generation_events
  for insert with check (user_id = auth.uid());

drop policy if exists generation_events_select_own on public.generation_events;
create policy generation_events_select_own on public.generation_events
  for select using (user_id = auth.uid());

-- Intentionally no update/delete policies: the ledger is append-only for its
-- owner, so a user cannot free up quota by deleting their own rows.
