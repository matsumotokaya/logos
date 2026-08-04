-- ============================================================================
-- 0029 - BrandKnowledge: claims that accumulate, values that are chosen
--
-- Design: docs/schema-v2.md §7
--
-- This replaces the shape of brand_profiles (one mutable jsonb per node, which
-- a later generation could silently overwrite). Instead:
--
--   brand_knowledge_claims   append-only. Every extraction, every structuring
--                            pass, every user correction adds a row with its
--                            source and confidence. Contradictions stay.
--   brand_knowledge_values   the canonical value a person adopted. Changes
--                            only through an explicit adoption.
--
-- Two constraints carry the requirement "never store fiction as fact":
--
--   * a fact claim may not come from source_kind='llm_generation'
--   * confidence vocabularies differ for facts and for expression
--
-- The LP pipeline deliberately generates fictional testimonials, client names
-- and metrics (lib/campaign/schema.ts). Those belong to a take's copy, and this
-- table has no path that would let them become stored facts.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.brand_knowledge_claims (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_entities(id) on delete cascade,
  variant_id  uuid,
  field_path  text not null check (field_path ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+){0,3}$'),
  layer       text not null check (layer in ('fact','expression')),
  value       jsonb not null,
  confidence  text not null,
  source_kind text not null check (source_kind in
                ('user_input','url_extraction','file_extraction',
                 'llm_structuring','llm_generation','derived','render_output')),
  source_ref  jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  recorded_by uuid references public.users(user_id) on delete set null,
  run_id      uuid references public.take_runs(id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (variant_id, brand_id)
    references public.brand_variants(id, brand_id) on delete cascade,
  constraint claims_confidence_matches_layer check (
    (layer = 'fact'
      and confidence in ('confirmed','evidenced','inferred','unknown'))
    or (layer = 'expression'
      and confidence in ('suggested','adopted'))
  ),
  constraint claims_no_fiction_as_fact check (
    layer <> 'fact' or source_kind <> 'llm_generation'
  )
);
alter table public.brand_knowledge_claims enable row level security;

create index if not exists brand_knowledge_claims_field_idx
  on public.brand_knowledge_claims (brand_id, field_path, observed_at desc);
create index if not exists brand_knowledge_claims_run_idx
  on public.brand_knowledge_claims (run_id) where run_id is not null;

comment on table public.brand_knowledge_claims is
  'Append-only statements about a Brand, with source and confidence. Contradictions are kept, not resolved by deletion.';
comment on column public.brand_knowledge_claims.variant_id is
  'NULL means the claim is about the Brand as a whole rather than one audience variant.';
comment on constraint claims_no_fiction_as_fact on public.brand_knowledge_claims is
  'Generated sample copy can never be stored as a fact. Removing this check reopens the data-poisoning path the pivot review flagged.';

create table if not exists public.brand_knowledge_values (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brand_entities(id) on delete cascade,
  variant_id       uuid,
  field_path       text not null check (field_path ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+){0,3}$'),
  layer            text not null check (layer in ('fact','expression')),
  value            jsonb not null,
  confidence       text not null,
  adopted_claim_id uuid references public.brand_knowledge_claims(id) on delete set null,
  decided_by       uuid references public.users(user_id) on delete set null,
  decided_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (variant_id, brand_id)
    references public.brand_variants(id, brand_id) on delete cascade,
  constraint values_confidence_matches_layer check (
    (layer = 'fact' and confidence in ('confirmed','evidenced','inferred'))
    or (layer = 'expression' and confidence = 'adopted')
  )
);
alter table public.brand_knowledge_values enable row level security;

-- 'unknown' is a claim, never a decision: a value row means somebody chose it.
create unique index if not exists brand_knowledge_values_brand_field_uq
  on public.brand_knowledge_values (brand_id, field_path)
  where variant_id is null;
create unique index if not exists brand_knowledge_values_variant_field_uq
  on public.brand_knowledge_values (brand_id, variant_id, field_path)
  where variant_id is not null;

comment on table public.brand_knowledge_values is
  'The adopted value per field. Generation adds claims and never writes here; only an explicit adoption does.';
comment on column public.brand_knowledge_values.adopted_claim_id is
  'Which claim was accepted. Kept so "who decided this, and on what evidence" stays answerable after the fact.';

-- ---------- policies --------------------------------------------------------

-- Claims and values are readable at the view rung so a viewer can see what the
-- brand knows about itself. Claims may only be appended (no UPDATE/DELETE
-- policy at all, like logo_activities). Adopting a value is a core-rung act:
-- declaring "this is the correct fact" is brand-record editing, not output work.

drop policy if exists brand_knowledge_claims_select on public.brand_knowledge_claims;
create policy brand_knowledge_claims_select on public.brand_knowledge_claims
  for select to authenticated
  using (private.is_registered_user() and private.can_view_brand_entity(brand_id));

drop policy if exists brand_knowledge_claims_insert on public.brand_knowledge_claims;
create policy brand_knowledge_claims_insert on public.brand_knowledge_claims
  for insert to authenticated
  with check (
    private.is_registered_user()
    and private.can_edit_brand_output(brand_id)
    and (recorded_by is null or recorded_by = auth.uid())
  );

drop policy if exists brand_knowledge_values_select on public.brand_knowledge_values;
create policy brand_knowledge_values_select on public.brand_knowledge_values
  for select to authenticated
  using (private.is_registered_user() and private.can_view_brand_entity(brand_id));

drop policy if exists brand_knowledge_values_write on public.brand_knowledge_values;
create policy brand_knowledge_values_write on public.brand_knowledge_values
  for all to authenticated
  using (private.is_registered_user() and private.can_edit_brand_core(brand_id))
  with check (
    private.is_registered_user()
    and private.can_edit_brand_core(brand_id)
    and (decided_by is null or decided_by = auth.uid())
  );

-- ---------- verification ---------------------------------------------------

do $$
begin
  -- The anti-fiction constraint is the point of this migration; prove it bites.
  -- Skipped on a fresh database that has no Brand to attach the probe to.
  if exists (select 1 from public.brand_entities where brand_kind is not null) then
    begin
      insert into public.brand_knowledge_claims (
        brand_id, field_path, layer, value, confidence, source_kind
      )
      select id, 'offering.name', 'fact', '"probe"'::jsonb, 'inferred', 'llm_generation'
      from public.brand_entities
      where brand_kind is not null
      limit 1;
      raise exception 'Migration contract failed: a generated value was accepted as a fact.';
    exception
      when check_violation then null;
    end;
  end if;
end;
$$;

select
  to_regclass('public.brand_knowledge_claims') is not null as has_claims,
  to_regclass('public.brand_knowledge_values') is not null as has_values,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'brand_knowledge_claims'
      and cmd in ('UPDATE','DELETE','ALL')
  ) as claims_are_append_only;
