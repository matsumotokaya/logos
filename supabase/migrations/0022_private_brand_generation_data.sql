-- ============================================================================
-- 0022 - keep technical generation records private
--
-- Public LP/video delivery uses dedicated application routes. The catalog
-- tables below contain source URLs, processing steps, usage/cost, errors, and
-- immutable Brand Kit snapshots, so a public logo must not make them readable.
-- ============================================================================

drop policy if exists brand_generation_runs_select
  on public.brand_generation_runs;
create policy brand_generation_runs_select on public.brand_generation_runs
  for select to authenticated
  using (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_generation_runs_insert
  on public.brand_generation_runs;
create policy brand_generation_runs_insert on public.brand_generation_runs
  for insert to authenticated
  with check (
    triggered_by = auth.uid()
    and private.can_manage_brand_entity(brand_id)
  );

drop policy if exists brand_generation_runs_update
  on public.brand_generation_runs;
create policy brand_generation_runs_update on public.brand_generation_runs
  for update to authenticated
  using (private.can_manage_brand_entity(brand_id))
  with check (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_generation_runs_delete
  on public.brand_generation_runs;
create policy brand_generation_runs_delete on public.brand_generation_runs
  for delete to authenticated
  using (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_assets_select on public.brand_assets;
create policy brand_assets_select on public.brand_assets
  for select to authenticated
  using (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_assets_insert on public.brand_assets;
create policy brand_assets_insert on public.brand_assets
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.can_manage_brand_entity(brand_id)
  );

drop policy if exists brand_assets_update on public.brand_assets;
create policy brand_assets_update on public.brand_assets
  for update to authenticated
  using (private.can_manage_brand_entity(brand_id))
  with check (private.can_manage_brand_entity(brand_id));

drop policy if exists brand_assets_delete on public.brand_assets;
create policy brand_assets_delete on public.brand_assets
  for delete to authenticated
  using (private.can_manage_brand_entity(brand_id));

-- Trigger functions do not need to be directly callable through PostgREST.
revoke all on function private.sync_legacy_brand_organization() from public;
revoke all on function private.redirect_legacy_brand_profile_subject() from public;
revoke all on function private.ensure_logo_subject_entity() from public;

comment on table public.brand_generation_runs is
  'Private technical history. Public outputs are delivered through dedicated signed/application routes.';
comment on table public.brand_assets is
  'Private management catalog. Asset publication is controlled by dedicated delivery routes, not table visibility.';

select
  not has_table_privilege('anon', 'public.brand_generation_runs', 'select')
    or not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'brand_generation_runs'
        and 'anon' = any(roles)
    ) as generation_runs_not_exposed_by_policy,
  not has_table_privilege('anon', 'public.brand_assets', 'select')
    or not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'brand_assets'
        and 'anon' = any(roles)
    ) as brand_assets_not_exposed_by_policy;
