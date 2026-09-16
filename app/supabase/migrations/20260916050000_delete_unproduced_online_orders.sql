-- A deleted online order is removed from orders, planning and audit history.
-- Only a temporary cancellation-mail job survives until mail and private-photo
-- cleanup have both completed. Orders with recorded production cannot be deleted.
begin;

alter table public.letter_mail_outbox alter column order_id drop not null;

create or replace function public.lettershop_delete_unproduced_order(
  p_order_id uuid, p_expected_order_number text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_order public.letter_orders%rowtype;
  v_job_id uuid;
  v_photo_paths jsonb;
begin
  select * into v_order from public.letter_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Bestelling niet gevonden'; end if;
  if v_order.channel <> 'ONLINE' or v_order.order_number <> p_expected_order_number then
    raise exception 'Bestelling en bevestiging komen niet overeen';
  end if;
  if v_order.fulfillment_status <> 'NEW' then
    raise exception 'Alleen een nieuwe, niet-afgehandelde bestelling kan worden verwijderd';
  end if;
  if exists (
    select 1 from public.letter_production_registration_parts part
    join public.letter_production_allocations allocation on allocation.id = part.allocation_id
    join public.letter_order_items item on item.id = allocation.order_item_id
    where item.order_id = p_order_id
  ) or exists (
    select 1 from public.letter_inventory_movements movement
    join public.letter_order_items item on item.id = movement.order_item_id
    where item.order_id = p_order_id
  ) then
    raise exception 'Er zijn al letters geproduceerd of omgeboekt; deze order mag niet worden gewist';
  end if;
  -- A confirmation/backup already being sent must finish before deletion.
  if exists (select 1 from public.letter_mail_outbox where order_id = p_order_id and status = 'SENDING' for update) then
    raise exception 'Er wordt nog een e-mail verstuurd; probeer het over enkele seconden opnieuw';
  end if;
  select coalesce(jsonb_agg(distinct logo_storage_path), '[]'::jsonb) into v_photo_paths
  from public.letter_order_items
  where order_id = p_order_id and logo_storage_path is not null;

  delete from public.letter_mail_outbox where order_id = p_order_id;
  insert into public.letter_mail_outbox (order_id, template, payload)
  values (null, 'ORDER_CANCELLATION', jsonb_build_object(
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'photo_paths', v_photo_paths
  )) returning id into v_job_id;

  delete from public.letter_audit_events where entity_type = 'order' and entity_id = p_order_id;
  delete from public.letter_audit_events where entity_type = 'order_item'
    and entity_id in (select id from public.letter_order_items where order_id = p_order_id);
  delete from public.letter_audit_events where entity_type = 'production_allocation'
    and entity_id in (
      select allocation.id from public.letter_production_allocations allocation
      join public.letter_order_items item on item.id = allocation.order_item_id
      where item.order_id = p_order_id
    );
  delete from public.letter_production_allocations where order_item_id in
    (select id from public.letter_order_items where order_id = p_order_id);
  delete from public.letter_order_items where order_id = p_order_id;
  delete from public.letter_orders where id = p_order_id;
  return v_job_id;
end;
$$;

revoke all on function public.lettershop_delete_unproduced_order(uuid, text) from public, anon, authenticated;
grant execute on function public.lettershop_delete_unproduced_order(uuid, text) to service_role;

commit;
