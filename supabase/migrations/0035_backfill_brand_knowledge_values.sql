-- 0035 - complete the brand_profiles backfill by adopting migrated claims
--
-- A data-modifying CTE executes in one statement snapshot: the main INSERT in
-- 0034 could not see claims inserted by its sibling CTE. At this point those
-- claims are durable, so adopt them without re-reading legacy JSON. Existing
-- explicit values always win.

insert into public.brand_knowledge_values (
  brand_id, field_path, layer, value, confidence, adopted_claim_id,
  decided_by, decided_at, updated_at
)
select
  claim.brand_id,
  claim.field_path,
  claim.layer,
  claim.value,
  case
    when claim.layer = 'expression' then 'adopted'
    when claim.confidence = 'confirmed' then 'confirmed'
    when claim.confidence = 'evidenced' then 'evidenced'
    else 'inferred'
  end,
  claim.id,
  claim.recorded_by,
  now(),
  now()
from public.brand_knowledge_claims as claim
where claim.variant_id is null
  and claim.source_ref @> '{"migrated_from":"brand_profiles"}'::jsonb
  and not exists (
    select 1
    from public.brand_knowledge_values as existing
    where existing.brand_id = claim.brand_id
      and existing.variant_id is null
      and existing.field_path = claim.field_path
  );

select count(*) as migrated_values
from public.brand_knowledge_values as value
where exists (
  select 1
  from public.brand_knowledge_claims as claim
  where claim.id = value.adopted_claim_id
    and claim.source_ref @> '{"migrated_from":"brand_profiles"}'::jsonb
);
