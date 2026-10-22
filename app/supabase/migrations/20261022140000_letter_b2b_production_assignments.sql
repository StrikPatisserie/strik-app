begin;
create table if not exists public.letter_b2b_production_assignments (
  order_id text primary key check(length(order_id) between 1 and 180),
  season integer not null check(season between 2020 and 2100),
  batch_id uuid references public.letter_production_batches(id),
  revision integer not null default 1 check(revision>0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.letter_b2b_production_assignments enable row level security;
revoke all on public.letter_b2b_production_assignments from anon,authenticated;
grant all on public.letter_b2b_production_assignments to service_role;
create or replace function public.letter_plan_b2b_order(p_order_id text,p_season integer,p_batch_id uuid,p_previous_batch_id uuid,p_revision integer,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing letter_b2b_production_assignments; batch letter_production_batches; saved letter_b2b_production_assignments;
begin
  perform pg_advisory_xact_lock(hashtext('letter-b2b-plan:'||p_order_id));
  select * into existing from letter_b2b_production_assignments where order_id=p_order_id for update;
  if coalesce(existing.revision,0)<>p_revision then raise exception 'De planning is intussen gewijzigd. Ververs de lijst.' using errcode='P0001'; end if;
  if existing.order_id is not null and existing.season<>p_season then raise exception 'Het seizoen van deze planning klopt niet.' using errcode='P0001'; end if;
  if existing.order_id is not null and existing.batch_id is distinct from p_previous_batch_id then raise exception 'De vorige productieronde is gewijzigd. Ververs de lijst.' using errcode='P0001'; end if;
  for batch in select * from letter_production_batches where id in (p_batch_id,p_previous_batch_id) order by id for update loop
    if batch.season<>p_season or batch.status not in ('OPEN','PLANNED') or batch.order_deadline_at is null or now()>=batch.order_deadline_at
      or exists(select 1 from letter_production_checklists where batch_id=batch.id) then
      raise exception 'De productieronde staat vast of de deadline is voorbij. De planning is niet gewijzigd.' using errcode='P0001';
    end if;
  end loop;
  if p_batch_id is not null and not exists(select 1 from letter_production_batches where id=p_batch_id) then raise exception 'Productieronde niet gevonden.' using errcode='P0001'; end if;
  insert into letter_b2b_production_assignments(order_id,season,batch_id,updated_by) values(p_order_id,p_season,p_batch_id,p_actor_id)
    on conflict(order_id) do update set batch_id=excluded.batch_id,revision=letter_b2b_production_assignments.revision+1,updated_by=p_actor_id,updated_at=now() returning * into saved;
  if coalesce(p_batch_id,p_previous_batch_id) is not null then
    insert into letter_audit_events(entity_type,entity_id,action,details,actor_id) values('production_batch',coalesce(p_batch_id,p_previous_batch_id),'b2b_order_planned',jsonb_build_object('order_id',p_order_id,'previous_batch_id',p_previous_batch_id,'batch_id',p_batch_id),p_actor_id);
  end if;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.letter_plan_b2b_order(text,integer,uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.letter_plan_b2b_order(text,integer,uuid,uuid,integer,uuid) to service_role;
commit;
