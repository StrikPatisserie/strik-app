-- Authenticated production endpoint supplies a fully reviewed change. All reads
-- are revision checked in one transaction; no printed rows or made quantities
-- may be discarded. Only service_role can call this function.
create or replace function public.letter_save_b2b_schedule(
  p_order_id text, p_season integer, p_batch_id uuid, p_date date,
  p_revision integer, p_checks jsonb, p_lists jsonb, p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  existing letter_b2b_production_assignments;
  batch letter_production_batches;
  saved letter_production_checklists;
  checked jsonb; proposed jsonb; part jsonb; old_row jsonb;
  before_lists jsonb := '[]'::jsonb;
  target_main boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('letter-b2b-plan:'||p_order_id));
  select * into existing from letter_b2b_production_assignments where order_id=p_order_id for update;
  if coalesce(existing.revision,0)<>p_revision or (existing.order_id is not null and existing.season<>p_season) then
    raise exception 'De planning is intussen gewijzigd. Ververs de lijst.' using errcode='P0001';
  end if;
  if jsonb_typeof(p_checks)<>'array' or jsonb_array_length(p_checks)=0 or jsonb_typeof(p_lists)<>'array'
    or (p_date is null and p_batch_id is not null) or (p_date is not null and p_batch_id is null)
    or (p_date is not null and (extract(year from p_date)<>p_season or p_date<(now() at time zone 'Europe/Amsterdam')::date)) then
    raise exception 'Controleer de gekozen productiedag.' using errcode='P0001';
  end if;
  if (select count(*) from letter_production_batches where season=p_season and status<>'CLOSED')<>jsonb_array_length(p_checks)
    or (select count(distinct value->>'batch_id') from jsonb_array_elements(p_checks))<>jsonb_array_length(p_checks) then
    raise exception 'De productiedagen zijn intussen gewijzigd. Ververs de lijst.' using errcode='P0001';
  end if;
  for batch in select * from letter_production_batches where season=p_season and status<>'CLOSED' order by id for update loop
    select value into checked from jsonb_array_elements(p_checks) where value->>'batch_id'=batch.id::text;
    select * into saved from letter_production_checklists where batch_id=batch.id for update;
    if checked is null or coalesce(saved.revision,0)<>(checked->>'revision')::integer then
      raise exception 'De productie is intussen gewijzigd. Ververs de lijst en controleer je keuze.' using errcode='P0001';
    end if;
    if saved.batch_id is not null then before_lists := before_lists || jsonb_build_array(to_jsonb(saved)); end if;
    if p_date is not null and p_date in (batch.production_start_date,batch.production_date) then
      target_main := true;
      if p_batch_id<>batch.id or batch.status not in ('OPEN','PLANNED') or batch.order_deadline_at is null
        or clock_timestamp()>=batch.order_deadline_at or saved.locked_at is not null then
        raise exception 'Deze hoofdproductiedag staat vast. Kies een nieuwe productiedag.' using errcode='P0001';
      end if;
    end if;
    select value into proposed from jsonb_array_elements(p_lists) where value->>'batch_id'=batch.id::text;
    if saved.batch_id is not null and (proposed is null or jsonb_typeof(proposed->'rows')<>'array' or jsonb_typeof(proposed->'supplements')<>'array') then
      raise exception 'De productiegegevens zijn onvolledig.' using errcode='P0001';
    end if;
    if saved.locked_at is not null and saved.rows is distinct from proposed->'rows' then
      raise exception 'Een vastgezette productielijst blijft behouden.' using errcode='P0001';
    end if;
    for part in select value from jsonb_array_elements(coalesce(saved.supplements,'[]'::jsonb)) loop
      if coalesce(part->>'lockedAt','')<>'' and not exists(select 1 from jsonb_array_elements(proposed->'supplements') s where s=part) then
        raise exception 'Een geprinte aanvulling blijft behouden.' using errcode='P0001';
      end if;
    end loop;
    -- A shared row cannot safely attribute partial production to one customer.
    for old_row in select value from jsonb_array_elements(coalesce(saved.rows,'[]'::jsonb)) loop
      if coalesce((old_row->>'produced')::integer,0)>0 and not exists(select 1 from jsonb_array_elements(proposed->'rows') r where r=old_row) then
        raise exception 'Er zijn al aantallen gemaakt. Controleer eerst de productie.' using errcode='P0001';
      end if;
    end loop;
    for part in select value from jsonb_array_elements(coalesce(saved.supplements,'[]'::jsonb)) loop
      if exists(select 1 from jsonb_array_elements(part->'rows') r where coalesce((r->>'produced')::integer,0)>0)
        and not exists(select 1 from jsonb_array_elements(proposed->'supplements') s where s=part) then
        raise exception 'Er zijn al aantallen gemaakt in deze aanvulling.' using errcode='P0001';
      end if;
    end loop;
  end loop;
  if p_batch_id is not null and not exists(select 1 from letter_production_batches where id=p_batch_id and season=p_season and status<>'CLOSED') then
    raise exception 'Productieronde niet gevonden.' using errcode='P0001';
  end if;
  if p_date is not null and not target_main and not exists(
    select 1 from jsonb_array_elements(p_lists) l, jsonb_array_elements(l->'supplements') s
    where l->>'batch_id'=p_batch_id::text and l->>'locked_at' is not null and s->>'date'=p_date::text
      and coalesce(s->>'targetBatchId','')='' and coalesce(s->>'lockedAt','')=''
  ) then raise exception 'De extra productiedag ontbreekt.' using errcode='P0001'; end if;
  for checked in select value from jsonb_array_elements(p_checks) loop
    select value into proposed from jsonb_array_elements(p_lists) where value->>'batch_id'=checked->>'batch_id';
    insert into letter_production_checklists(batch_id,rows,supplements,locked_at,revision,plan_revision,updated_by)
      values((checked->>'batch_id')::uuid,coalesce(proposed->'rows','[]'::jsonb),coalesce(proposed->'supplements','[]'::jsonb),null,1,1,p_actor_id)
      on conflict(batch_id) do update set rows=excluded.rows,supplements=excluded.supplements,
        revision=letter_production_checklists.revision+1,updated_at=now(),updated_by=p_actor_id;
  end loop;
  insert into letter_b2b_production_assignments(order_id,season,batch_id,updated_by)
    values(p_order_id,p_season,p_batch_id,p_actor_id)
    on conflict(order_id) do update set batch_id=excluded.batch_id,revision=letter_b2b_production_assignments.revision+1,updated_at=now(),updated_by=p_actor_id;
  insert into letter_audit_events(entity_type,entity_id,action,details,actor_id)
    values('production_batch',coalesce(p_batch_id,(p_checks->0->>'batch_id')::uuid),'b2b_schedule_changed',
      jsonb_build_object('order_id',p_order_id,'date',p_date,'batch_id',p_batch_id,'previous_assignment',to_jsonb(existing),'previous_lists',before_lists),p_actor_id);
  return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.letter_save_b2b_schedule(text,integer,uuid,date,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.letter_save_b2b_schedule(text,integer,uuid,date,integer,jsonb,jsonb,uuid) to service_role;
