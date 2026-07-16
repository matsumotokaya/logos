-- ============================================================================
-- 0008 - asset registry foundation
--
-- The user-facing Assets area treats a logo as the canonical record and keeps
-- its subject, files, presentation, credits, and ownership as separate data.
-- This migration adds the missing relational pieces without changing current
-- logo URLs or ownership semantics.
--
--   brand_entities: real-world company / brand represented by a logo
--   logo_lockups: horizontal / vertical / symbol hierarchy under a candidate
--   logo_variants.colorway: original / black / reversed files under a lockup
--   logo_transfer_requests: future transfer and purchase-inquiry workflow
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------- real-world company / brand subjects ----------------------------

create table if not exists public.brand_entities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  entity_type      text not null default 'company'
                   check (entity_type in ('company', 'brand', 'product', 'service', 'other')),
  parent_entity_id uuid references public.brand_entities(id) on delete set null,
  linked_org_id    uuid references public.organizations(org_id) on delete set null,
  website          text not null default '',
  industry         text not null default '',
  location         text not null default '',
  description      text not null default '',
  created_by       uuid references public.users(user_id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (parent_entity_id is null or parent_entity_id <> id)
);
alter table public.brand_entities enable row level security;

create index if not exists brand_entities_parent_idx
  on public.brand_entities (parent_entity_id);
create index if not exists brand_entities_linked_org_idx
  on public.brand_entities (linked_org_id);
create index if not exists brand_entities_created_by_idx
  on public.brand_entities (created_by);

alter table public.logos
  add column if not exists subject_entity_id uuid
  references public.brand_entities(id) on delete set null;

create index if not exists logos_subject_entity_idx
  on public.logos (subject_entity_id);

-- A subject is managed separately from logo ownership. Before a company joins
-- the service, the account that created the subject can maintain it. Once it is
-- linked to an organization, that organization's brand editors can maintain it
-- too. Moving a logo between owners never silently changes the subject.
create or replace function public.can_manage_brand_entity(p_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities e
    where e.id = p_entity_id
      and (
        e.created_by = auth.uid()
        or public.has_org_role(
          e.linked_org_id,
          array['owner','admin','editor']::public.org_role[]
        )
      )
  );
$$;

create or replace function public.can_view_brand_entity(p_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_entity_id is not null and exists (
    select 1
    from public.brand_entities e
    where e.id = p_entity_id
      and (
        e.created_by = auth.uid()
        or public.has_org_role(
          e.linked_org_id,
          array['owner','admin','editor','purchaser','viewer']::public.org_role[]
        )
        or exists (
          select 1
          from public.logos l
          where l.subject_entity_id = e.id
            and public.can_view_logo(l.id)
        )
      )
  );
$$;

drop policy if exists brand_entities_select on public.brand_entities;
create policy brand_entities_select on public.brand_entities
  for select using (public.can_view_brand_entity(id));

drop policy if exists brand_entities_insert on public.brand_entities;
create policy brand_entities_insert on public.brand_entities
  for insert to authenticated with check (
    created_by = auth.uid()
    and (
      linked_org_id is null
      or public.has_org_role(
        linked_org_id,
        array['owner','admin']::public.org_role[]
      )
    )
  );

drop policy if exists brand_entities_update on public.brand_entities;
create policy brand_entities_update on public.brand_entities
  for update using (public.can_manage_brand_entity(id))
  with check (public.can_manage_brand_entity(id));

drop policy if exists brand_entities_delete on public.brand_entities;
create policy brand_entities_delete on public.brand_entities
  for delete using (public.can_manage_brand_entity(id));

comment on table public.brand_entities is
  'Real-world company, brand, product, or service represented by logos; independent from service account ownership.';
comment on column public.logos.subject_entity_id is
  'Company or brand represented by this logo. This does not change when logo ownership changes.';
comment on column public.brand_entities.linked_org_id is
  'Optional service organization that manages this real-world entity; not the owner of every referenced logo.';

-- ---------- candidate -> lockup -> colorway hierarchy ----------------------

create table if not exists public.logo_lockups (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.logo_candidates(id) on delete cascade,
  kind         text not null default 'primary'
               check (kind in ('primary', 'horizontal', 'vertical', 'symbol', 'wordmark', 'custom')),
  label        text not null default '',
  is_primary   boolean not null default false,
  sort_order   integer not null default 0 check (sort_order >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.logo_lockups enable row level security;

create unique index if not exists logo_lockups_id_candidate_uq
  on public.logo_lockups (id, candidate_id);
create unique index if not exists logo_lockups_primary_uq
  on public.logo_lockups (candidate_id) where is_primary;
create index if not exists logo_lockups_candidate_order_idx
  on public.logo_lockups (candidate_id, sort_order, created_at);

-- Keep the hierarchy complete for candidates created after this migration.
-- The candidate SVG itself is the primary/original file; the lockup row gives
-- alternate files a stable parent without duplicating that master SVG.
create or replace function public.handle_new_logo_candidate_lockup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.logo_lockups (
    candidate_id,
    kind,
    label,
    is_primary,
    sort_order
  ) values (
    new.id,
    'primary',
    'Primary',
    true,
    0
  )
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_logo_candidate_created_create_lockup
  on public.logo_candidates;
create trigger on_logo_candidate_created_create_lockup
  after insert on public.logo_candidates
  for each row execute function public.handle_new_logo_candidate_lockup();

-- Every existing candidate's master SVG is its primary/original lockup.
insert into public.logo_lockups (candidate_id, kind, label, is_primary, sort_order)
select c.id, 'primary', 'Primary', true, 0
from public.logo_candidates c
where not exists (
  select 1
  from public.logo_lockups l
  where l.candidate_id = c.id and l.is_primary
);

-- Preserve structural variants that were previously encoded only in `kind`.
insert into public.logo_lockups (candidate_id, kind, label, is_primary, sort_order)
select distinct
  v.candidate_id,
  v.kind,
  case v.kind
    when 'horizontal' then 'Horizontal'
    when 'vertical' then 'Vertical'
    when 'symbol' then 'Symbol'
    when 'wordmark' then 'Wordmark'
  end,
  false,
  case v.kind
    when 'horizontal' then 10
    when 'vertical' then 20
    when 'symbol' then 30
    when 'wordmark' then 40
  end
from public.logo_variants v
where v.kind in ('horizontal', 'vertical', 'symbol', 'wordmark')
  and not exists (
    select 1
    from public.logo_lockups l
    where l.candidate_id = v.candidate_id and l.kind = v.kind
  );

alter table public.logo_variants
  add column if not exists lockup_id uuid;
alter table public.logo_variants
  add column if not exists colorway text not null default 'original';
alter table public.logo_variants
  add column if not exists label text not null default '';
alter table public.logo_variants
  add column if not exists sort_order integer not null default 0;
alter table public.logo_variants
  add column if not exists updated_at timestamptz not null default now();

-- Map old structural rows to their lockup; all other legacy rows live under
-- the primary lockup. The old `kind` column remains as a stable variant key so
-- current application code keeps working during the UI migration.
update public.logo_variants v
set lockup_id = coalesce(
  (
    select l.id
    from public.logo_lockups l
    where l.candidate_id = v.candidate_id
      and l.kind = v.kind
      and v.kind in ('horizontal', 'vertical', 'symbol', 'wordmark')
    order by l.created_at
    limit 1
  ),
  (
    select l.id
    from public.logo_lockups l
    where l.candidate_id = v.candidate_id and l.is_primary
    order by l.created_at
    limit 1
  )
)
where v.lockup_id is null;

update public.logo_variants
set colorway = case kind
  when 'mono_black' then 'black'
  when 'mono_white' then 'reversed'
  when 'full_color' then 'full_color'
  else 'original'
end
where colorway = 'original';

alter table public.logo_variants
  alter column lockup_id set not null;

do $$ begin
  alter table public.logo_variants
    add constraint logo_variants_lockup_candidate_fkey
    foreign key (lockup_id, candidate_id)
    references public.logo_lockups(id, candidate_id)
    on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.logo_variants
    add constraint logo_variants_colorway_check
    check (colorway in ('original', 'full_color', 'black', 'white', 'reversed', 'custom'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.logo_variants
    add constraint logo_variants_sort_order_check
    check (sort_order >= 0);
exception when duplicate_object then null; end $$;

create index if not exists logo_variants_lockup_order_idx
  on public.logo_variants (lockup_id, sort_order, created_at);

drop policy if exists logo_lockups_select on public.logo_lockups;
create policy logo_lockups_select on public.logo_lockups
  for select using (
    public.can_view_logo(public.candidate_logo_id(candidate_id))
  );

drop policy if exists logo_lockups_write on public.logo_lockups;
create policy logo_lockups_write on public.logo_lockups
  for all using (
    public.can_edit_logo(public.candidate_logo_id(candidate_id))
  ) with check (
    public.can_edit_logo(public.candidate_logo_id(candidate_id))
  );

comment on table public.logo_lockups is
  'Composition variants such as primary, horizontal, vertical, symbol-only, and wordmark under one candidate.';
comment on column public.logo_variants.lockup_id is
  'Lockup containing this concrete colorway file.';
comment on column public.logo_variants.colorway is
  'Color treatment within a lockup: original, full color, black, white, reversed, or custom.';

-- ---------- future ownership transfer / purchase inquiry workflow ----------

create table if not exists public.logo_transfer_requests (
  id                    uuid primary key default gen_random_uuid(),
  logo_id               text not null references public.logos(id) on delete cascade,
  request_kind          text not null
                        check (request_kind in ('ownership_transfer', 'purchase_inquiry')),
  requested_by          uuid not null references public.users(user_id) on delete cascade,
  source_owner_user_id  uuid references public.users(user_id) on delete set null,
  source_owner_org_id   uuid references public.organizations(org_id) on delete set null,
  proposed_owner_user_id uuid references public.users(user_id) on delete set null,
  proposed_owner_org_id uuid references public.organizations(org_id) on delete set null,
  message               text not null default '',
  offer_amount          numeric(14,2),
  currency              text not null default 'JPY' check (currency ~ '^[A-Z]{3}$'),
  status                text not null default 'pending'
                        check (status in ('pending', 'accepted', 'rejected', 'canceled', 'completed')),
  responded_by          uuid references public.users(user_id) on delete set null,
  responded_at          timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (num_nonnulls(source_owner_user_id, source_owner_org_id) = 1),
  check (num_nonnulls(proposed_owner_user_id, proposed_owner_org_id) <= 1),
  check (
    request_kind <> 'ownership_transfer'
    or num_nonnulls(proposed_owner_user_id, proposed_owner_org_id) = 1
  ),
  check (offer_amount is null or offer_amount >= 0)
);
alter table public.logo_transfer_requests enable row level security;

create index if not exists logo_transfer_requests_logo_created_idx
  on public.logo_transfer_requests (logo_id, created_at desc);
create index if not exists logo_transfer_requests_requester_idx
  on public.logo_transfer_requests (requested_by, status, created_at desc);
create index if not exists logo_transfer_requests_target_user_idx
  on public.logo_transfer_requests (proposed_owner_user_id, status)
  where proposed_owner_user_id is not null;
create index if not exists logo_transfer_requests_target_org_idx
  on public.logo_transfer_requests (proposed_owner_org_id, status)
  where proposed_owner_org_id is not null;

create or replace function public.can_view_logo_transfer_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_request_id is not null and exists (
    select 1
    from public.logo_transfer_requests r
    where r.id = p_request_id
      and (
        r.requested_by = auth.uid()
        or r.source_owner_user_id = auth.uid()
        or r.proposed_owner_user_id = auth.uid()
        or public.has_org_role(
          r.source_owner_org_id,
          array['owner','admin']::public.org_role[]
        )
        or public.has_org_role(
          r.proposed_owner_org_id,
          array['owner','admin']::public.org_role[]
        )
        or public.can_admin_logo(r.logo_id)
      )
  );
$$;

drop policy if exists logo_transfer_requests_select on public.logo_transfer_requests;
create policy logo_transfer_requests_select on public.logo_transfer_requests
  for select using (public.can_view_logo_transfer_request(id));

-- This policy only creates a request record. Accepting it and changing owner
-- fields will be implemented later as one audited server-side transaction.
drop policy if exists logo_transfer_requests_insert on public.logo_transfer_requests;
create policy logo_transfer_requests_insert on public.logo_transfer_requests
  for insert to authenticated with check (
    requested_by = auth.uid()
    and exists (
      select 1
      from public.logos l
      where l.id = logo_id
        and l.owner_user_id is not distinct from source_owner_user_id
        and l.owner_org_id is not distinct from source_owner_org_id
    )
    and (
      (request_kind = 'ownership_transfer' and public.can_admin_logo(logo_id))
      or (request_kind = 'purchase_inquiry' and public.can_view_logo(logo_id))
    )
  );

comment on table public.logo_transfer_requests is
  'Pending ownership transfers and purchase inquiries. Owner changes must later be completed by an audited server-side transaction.';

-- No UPDATE/DELETE policy yet. Status transitions and ownership mutation must
-- land together in a later RPC so a client cannot accept its own transaction.

-- ---------- verification ----------------------------------------------------

select
  to_regclass('public.brand_entities') is not null as has_brand_entities,
  to_regclass('public.logo_lockups') is not null as has_logo_lockups,
  to_regclass('public.logo_transfer_requests') is not null as has_transfer_requests,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'logos'
      and column_name = 'subject_entity_id'
  ) as has_subject_entity,
  not exists (
    select 1 from public.logo_candidates c
    where not exists (
      select 1 from public.logo_lockups l
      where l.candidate_id = c.id and l.is_primary
    )
  ) as every_candidate_has_primary_lockup;
