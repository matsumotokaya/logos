-- ============================================================================
-- 0005 — logo slugs backing vanity URLs (docs/account-design.md §2)
--
-- A public logo with a slug is reachable at /{handle}/{slug}, where the
-- handle identifies the owner (public.handles). Slugs must therefore be
-- unique per owner — enforced separately for org-owned and personally owned
-- logos via partial unique indexes — and share the handle charset:
-- lowercase alphanumerics and hyphens, starting with an alphanumeric,
-- up to 63 characters.
-- Idempotent: safe to re-run.
-- ============================================================================

create unique index if not exists logos_org_slug_uq
  on public.logos (owner_org_id, slug)
  where slug is not null and owner_org_id is not null;

create unique index if not exists logos_user_slug_uq
  on public.logos (owner_user_id, slug)
  where slug is not null and owner_user_id is not null;

alter table public.logos drop constraint if exists logos_slug_format;
alter table public.logos add constraint logos_slug_format
  check (slug is null or slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62})$');

-- Verification
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('logos_org_slug_uq', 'logos_user_slug_uq');
