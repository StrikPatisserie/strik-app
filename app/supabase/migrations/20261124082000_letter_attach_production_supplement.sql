-- Keep transferred allocations in the original checklist for traceability.
-- Only the service API may attach an extra allocation to an open main day.
create or replace function public.letter_attach_production_supplement(
  p_source_id uuid, p_target_id uuid, p_revision integer, p_supplement jsonb, p_actor_id uuid
) returns jsonb language plpgsql set search_path = public as $$
declare
  source_list letter_production_checklists;
  target_list letter_production_checklists;
  target_batch letter_production_batches;
  source_season integer;
begin
  if p_source_id = p_target_id or p_target_id is null then
    raise exception 'Kies een andere open hoofdproductiedag.' using errcode='P0001';
  end if;
  select * into source_list from letter_production_checklists where batch_id=p_source_id for update;
  if source_list.batch_id is null or source_list.locked_at is null or source_list.revision<>p_revision then
    raise exception 'De oorspronkelijke lijst is intussen gewijzigd. Ververs de productielijst.' using errcode='P0001';
  end if;
  select season into source_season from letter_production_batches where id=p_source_id;
  select * into target_batch from letter_production_batches where id=p_target_id for update;
  if target_batch.id is null or target_batch.season<>source_season
    or target_batch.status not in ('OPEN','PLANNED')
    or target_batch.order_deadline_at is null or clock_timestamp()>=target_batch.order_deadline_at
    or p_supplement->>'date' not in (target_batch.production_date::text, target_batch.production_start_date::text)
    or p_supplement->>'targetBatchId' is distinct from p_target_id::text
    or coalesce(jsonb_typeof(p_supplement->'rows'),'')<>'array'
    or jsonb_array_length(p_supplement->'rows')=0
    or coalesce(p_supplement->>'lockedAt','')<>'' then
    raise exception 'Deze hoofdproductiedag staat vast of past niet bij de aanvulling. Kies een nieuwe productiedag.' using errcode='P0001';
  end if;
  if exists(select 1 from jsonb_array_elements(p_supplement->'rows') r
      where coalesce((r->>'produced')::integer,0)<>0 or coalesce((r->>'stock')::integer,0)<>0)
    or exists(select 1 from jsonb_array_elements(source_list.supplements) s where s->>'id'=p_supplement->>'id') then
    raise exception 'Deze aanvulling is al verwerkt of bevat gemaakte letters.' using errcode='P0001';
  end if;
  insert into letter_production_checklists(batch_id,rows,locked_at,updated_by)
    values(p_target_id,'[]'::jsonb,null,p_actor_id) on conflict(batch_id) do nothing;
  select * into target_list from letter_production_checklists where batch_id=p_target_id for update;
  if target_list.locked_at is not null then
    raise exception 'Deze hoofdproductiedag staat intussen vast. Kies een nieuwe productiedag.' using errcode='P0001';
  end if;
  update letter_production_checklists set supplements=supplements||jsonb_build_array(p_supplement),
    revision=revision+1,updated_at=now(),updated_by=p_actor_id
    where batch_id=p_source_id returning * into source_list;
  -- Invalidate any concurrent provisional save/freeze based on the old demand.
  update letter_production_checklists set revision=revision+1,updated_at=now(),updated_by=p_actor_id where batch_id=p_target_id;
  insert into letter_audit_events(entity_type,entity_id,action,details,actor_id)
    values('production_batch',p_target_id,'supplement_attached',
      jsonb_build_object('source_batch_id',p_source_id,'supplement_id',p_supplement->>'id','date',p_supplement->>'date'),p_actor_id);
  return to_jsonb(source_list);
end;
$$;
revoke all on function public.letter_attach_production_supplement(uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.letter_attach_production_supplement(uuid,uuid,integer,jsonb,uuid) to service_role;
