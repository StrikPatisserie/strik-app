-- Preliminary made quantities keep orders editable until the production deadline.
CREATE OR REPLACE FUNCTION public.letter_plan_b2b_order(p_order_id text, p_season integer, p_batch_id uuid, p_previous_batch_id uuid, p_revision integer, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare existing letter_b2b_production_assignments; batch letter_production_batches; saved letter_b2b_production_assignments;
begin
  perform pg_advisory_xact_lock(hashtext('letter-b2b-plan:'||p_order_id));
  select * into existing from letter_b2b_production_assignments where order_id=p_order_id for update;
  if coalesce(existing.revision,0)<>p_revision then raise exception 'De planning is intussen gewijzigd. Ververs de lijst.' using errcode='P0001'; end if;
  if existing.order_id is not null and existing.season<>p_season then raise exception 'Het seizoen van deze planning klopt niet.' using errcode='P0001'; end if;
  if existing.order_id is not null and existing.batch_id is distinct from p_previous_batch_id then raise exception 'De vorige productieronde is gewijzigd. Ververs de lijst.' using errcode='P0001'; end if;
  for batch in select * from letter_production_batches where id in (p_batch_id,p_previous_batch_id) order by id for update loop
    if batch.season<>p_season or batch.status not in ('OPEN','PLANNED') or batch.order_deadline_at is null or now()>=batch.order_deadline_at
      or exists(select 1 from letter_production_checklists where batch_id=batch.id and locked_at is not null) then
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
$function$;

CREATE OR REPLACE FUNCTION public.lettershop_order_edit_states(p_order_ids uuid[])
 RETURNS TABLE(order_id uuid, block_reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select o.id, case
    when o.channel <> 'ONLINE' or o.fulfillment_status <> 'NEW' then 'Deze bestelling is al afgehandeld of geannuleerd.'
    when o.requested_date < (now() at time zone 'Europe/Amsterdam')::date then 'De afhaaldatum is verstreken.'
    when o.customer_email is null or position('@' in o.customer_email) < 2 then 'Een geldig klantadres ontbreekt.'
    when exists(select 1 from letter_order_items i where i.order_id=o.id and i.unit_price_cents is null) then 'De opgeslagen prijzen ontbreken. Neem contact op met beheer.'
    when not exists(select 1 from letter_order_items i where i.order_id=o.id) then 'Deze bestelling heeft geen letterregels.'
    when exists(select 1 from letter_order_items i where i.order_id=o.id and (select count(*) from letter_production_allocations a where a.order_item_id=i.id) <> 1) then 'De productie-indeling moet eerst worden gecontroleerd.'
    when exists(
      select 1 from letter_order_items i
      join letter_production_allocations a on a.order_item_id=i.id
      join letter_production_batches b on b.id=a.batch_id
      where i.order_id=o.id and (b.status <> 'OPEN' or b.order_deadline_at is null
        or clock_timestamp() >= b.order_deadline_at
        or b.production_start_date <= (clock_timestamp() at time zone 'Europe/Amsterdam')::date
        or exists(select 1 from letter_production_checklists c where c.batch_id=b.id and c.locked_at is not null))
    ) then 'De productielijst staat vast. Wijzigen is gesloten.'
    when exists(select 1 from letter_order_items i join letter_production_allocations a on a.order_item_id=i.id
      join letter_production_registration_parts p on p.allocation_id=a.id where i.order_id=o.id)
      or exists(select 1 from letter_inventory_movements m join letter_order_items i on i.id=m.order_item_id where i.order_id=o.id)
      then 'Er zijn al letters gemaakt of uit voorraad gereserveerd.'
    when exists(select 1 from letter_mail_outbox m where m.order_id=o.id and m.status <> 'SENT')
      then 'Een eerdere bevestiging staat nog in de verzendwachtrij. Probeer het later opnieuw.'
    else null end
  from letter_orders o where o.id=any(p_order_ids);
$function$;
