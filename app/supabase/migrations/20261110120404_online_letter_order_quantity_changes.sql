-- One immutable customer confirmation per confirmed change.
alter table public.letter_mail_outbox drop constraint if exists letter_mail_outbox_order_id_template_key;
create unique index if not exists letter_mail_outbox_initial_template_unique
  on public.letter_mail_outbox(order_id, template) where template <> 'ORDER_CHANGE';

create or replace function public.lettershop_order_edit_states(p_order_ids uuid[])
returns table(order_id uuid, block_reason text)
language sql stable security invoker set search_path = public as $$
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
        or exists(select 1 from letter_production_checklists c where c.batch_id=b.id))
    ) then 'De productielijst staat vast. Wijzigen is gesloten.'
    when exists(select 1 from letter_order_items i join letter_production_allocations a on a.order_item_id=i.id
      join letter_production_registration_parts p on p.allocation_id=a.id where i.order_id=o.id)
      or exists(select 1 from letter_inventory_movements m join letter_order_items i on i.id=m.order_item_id where i.order_id=o.id)
      then 'Er zijn al letters gemaakt of uit voorraad gereserveerd.'
    when exists(select 1 from letter_mail_outbox m where m.order_id=o.id and m.status <> 'SENT')
      then 'Een eerdere bevestiging staat nog in de verzendwachtrij. Probeer het later opnieuw.'
    else null end
  from letter_orders o where o.id=any(p_order_ids);
$$;
revoke all on function public.lettershop_order_edit_states(uuid[]) from public, anon, authenticated;
grant execute on function public.lettershop_order_edit_states(uuid[]) to service_role;

create or replace function public.lettershop_change_quantities(
  p_request_key uuid, p_order_id uuid, p_expected_revision integer,
  p_expected_order_number text, p_lines jsonb, p_actor_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_order public.letter_orders%rowtype;
  v_line jsonb;
  v_item public.letter_order_items%rowtype;
  v_block text;
  v_job uuid;
  v_before jsonb;
  v_items jsonb;
  v_total bigint;
  v_wrap bigint;
  v_quantity integer;
  v_changes integer := 0;
begin
  if p_request_key is null or p_actor_id is null then raise exception 'De bevestiging of medewerker ontbreekt'; end if;
  -- Match the allocation writer's lock order, and serialize edits of this order.
  perform id from letter_order_items where order_id=p_order_id order by id for update;
  select * into v_order from letter_orders where id=p_order_id for update;
  if v_order.id is null then raise exception 'Bestelling niet gevonden'; end if;
  select (details->>'mail_job_id')::uuid into v_job from letter_audit_events
    where entity_type='order' and entity_id=p_order_id and action='quantities_changed'
      and details->>'request_key'=p_request_key::text and actor_id=p_actor_id limit 1;
  if v_job is not null then return v_job; end if;
  if v_order.channel <> 'ONLINE' or v_order.order_number is distinct from p_expected_order_number then raise exception 'Controleer de bestelling en het ordernummer'; end if;
  if v_order.revision is distinct from p_expected_revision then raise exception 'Deze bestelling is intussen gewijzigd. Ververs en controleer opnieuw'; end if;
  perform b.id from letter_production_batches b where b.id in (
    select a.batch_id from letter_production_allocations a join letter_order_items i on i.id=a.order_item_id where i.order_id=p_order_id
  ) order by b.id for update;
  select block_reason into v_block from lettershop_order_edit_states(array[p_order_id]);
  if v_block is not null then raise exception '%',v_block; end if;
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Controleer de letterregels'; end if;
  if jsonb_array_length(p_lines) <> (select count(*) from letter_order_items where order_id=p_order_id)
    or (select count(distinct value->>'itemId') from jsonb_array_elements(p_lines)) <> jsonb_array_length(p_lines)
    then raise exception 'De letterregels zijn intussen gewijzigd. Ververs de bestelling'; end if;
  select jsonb_agg(jsonb_build_object('itemId',id,'quantity',quantity) order by id) into v_before
    from letter_order_items where order_id=p_order_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(v_line->>'quantity','') !~ '^(0|[1-9][0-9]{0,5})$' then raise exception 'Vul een heel aantal in'; end if;
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity > 100000 then raise exception 'Het aantal is te groot'; end if;
    select * into v_item from letter_order_items where id=(v_line->>'itemId')::uuid and order_id=p_order_id;
    if v_item.id is null then raise exception 'Deze letterregel hoort niet bij de bestelling'; end if;
    if v_item.quantity <> v_quantity then v_changes := v_changes + 1; end if;
  end loop;
  if v_changes=0 then raise exception 'Pas eerst een aantal aan'; end if;
  if not exists(select 1 from jsonb_array_elements(p_lines) l where (l->>'quantity')::integer>0) then raise exception 'Er moet minimaal één letter overblijven'; end if;
  update letter_orders set revision=revision+1,updated_at=now(),updated_by=p_actor_id where id=p_order_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity=0 then
      delete from letter_production_allocations where order_item_id=(v_line->>'itemId')::uuid;
      delete from letter_order_items where id=(v_line->>'itemId')::uuid and order_id=p_order_id;
    else
      update letter_order_items set quantity=v_quantity,updated_at=now() where id=(v_line->>'itemId')::uuid and order_id=p_order_id;
      update letter_production_allocations set planned_quantity=v_quantity,order_revision_at_planning=v_order.revision+1,updated_at=now()
        where order_item_id=(v_line->>'itemId')::uuid;
    end if;
  end loop;
  select jsonb_agg(jsonb_build_object('letter',p.letter,'flavour',p.flavour,'size',p.size,'style',p.style,
    'quantity',i.quantity,'logo',i.logo,'logo_storage_path',i.logo_storage_path,'notes',i.notes,
    'unit_price_cents',i.unit_price_cents,'logo_price_cents',i.logo_price_cents) order by i.created_at,i.id),
    sum(i.quantity::bigint*(i.unit_price_cents+i.logo_price_cents+case when v_order.gift_wrap then v_order.gift_wrap_price_cents else 0 end)),
    sum(i.quantity::bigint*case when v_order.gift_wrap then v_order.gift_wrap_price_cents else 0 end)
    into v_items,v_total,v_wrap from letter_order_items i join letter_products p on p.id=i.product_id where i.order_id=p_order_id;
  insert into letter_mail_outbox(order_id,template,payload) values(p_order_id,'ORDER_CHANGE',jsonb_build_object(
    'order_number',v_order.order_number,'channel','ONLINE','customer_name',v_order.customer_name,
    'customer_email',v_order.customer_email,'phone',v_order.phone,'requested_date',v_order.requested_date,
    'pickup_location',v_order.pickup_location,'notes',v_order.notes,'gift_wrap',v_order.gift_wrap,
    'gift_wrap_price_cents',v_order.gift_wrap_price_cents,'gift_wrap_total_cents',v_wrap,'total_cents',v_total,
    'revision',v_order.revision+1,'items',v_items
  )) returning id into v_job;
  insert into letter_audit_events(entity_type,entity_id,action,details,actor_id) values('order',p_order_id,'quantities_changed',
    jsonb_build_object('request_key',p_request_key,'mail_job_id',v_job,'before',v_before,'after',p_lines,'revision',v_order.revision+1),p_actor_id);
  return v_job;
end;
$$;
revoke all on function public.lettershop_change_quantities(uuid,uuid,integer,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.lettershop_change_quantities(uuid,uuid,integer,text,jsonb,uuid) to service_role;
