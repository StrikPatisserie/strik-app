-- Test orders and mail jobs remain uncommitted. No mail sender is invoked.
begin;
do $$
declare
  v_batch uuid;
  v_product uuid;
  v_actor uuid;
  v_order uuid;
  v_item uuid;
  v_number text;
  v_job uuid;
  v_second_job uuid;
  v_key uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_blocked boolean;
  v_lines jsonb;
begin
  select id into strict v_product from letter_products where active and size='groot' limit 1;
  select id into strict v_actor from profiles where active limit 1;
  insert into letter_production_batches(season,production_date,production_start_date,pickup_from_date,order_deadline_at,status)
    values(2089,date '2089-11-17',date '2089-11-16',date '2089-11-19',now()+interval '5 days','OPEN') returning id into v_batch;
  v_order := letter_create_online_checkout(v_key,'Test wijziging','customer@example.invalid','0612345678',date '2089-11-21','lent',
    jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1,'logo',true,'logo_path',v_key::text||'/0.jpg')),'Testopmerking',true);
  select order_number into strict v_number from letter_orders where id=v_order;
  select id into strict v_item from letter_order_items where order_id=v_order;
  update letter_order_items set unit_price_cents=1234,logo_price_cents=75 where id=v_item;
  update letter_orders set gift_wrap_price_cents=100 where id=v_order;
  update letter_mail_outbox set status='SENT' where order_id=v_order;
  v_lines := jsonb_build_array(jsonb_build_object('itemId',v_item,'quantity',2));
  v_job := lettershop_change_quantities(v_request,v_order,1,v_number,v_lines,v_actor);
  if not exists(select 1 from letter_order_items where id=v_item and quantity=2 and unit_price_cents=1234 and logo_price_cents=75) then raise exception 'Stored prices or quantities changed incorrectly'; end if;
  if not exists(select 1 from letter_production_allocations where order_item_id=v_item and planned_quantity=2 and order_revision_at_planning=2) then raise exception 'Production allocation not updated'; end if;
  if not exists(select 1 from letter_mail_outbox where id=v_job and template='ORDER_CHANGE' and payload->>'total_cents'='2818' and payload->>'gift_wrap_total_cents'='200') then raise exception 'Immutable confirmation totals incorrect'; end if;
  if lettershop_change_quantities(v_request,v_order,1,v_number,v_lines,v_actor) <> v_job then raise exception 'Retry duplicated the edit'; end if;
  if (select revision from letter_orders where id=v_order) <> 2 then raise exception 'Retry changed revision'; end if;
  v_blocked := false;
  begin perform lettershop_change_quantities(gen_random_uuid(),v_order,2,v_number,jsonb_build_array(jsonb_build_object('itemId',v_item,'quantity',3)),v_actor);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Pending prior confirmation was ignored'; end if;
  update letter_mail_outbox set status='SENT' where id=v_job;
  v_blocked := false;
  begin perform lettershop_change_quantities(gen_random_uuid(),v_order,1,v_number,v_lines,v_actor);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Stale revision was accepted'; end if;
  v_second_job := lettershop_change_quantities(gen_random_uuid(),v_order,2,v_number,jsonb_build_array(jsonb_build_object('itemId',v_item,'quantity',3)),v_actor);
  if v_second_job=v_job or (select count(*) from letter_mail_outbox where order_id=v_order and template='ORDER_CHANGE') <> 2 then raise exception 'Repeated changes need separate confirmation snapshots'; end if;
  if (select payload->'items'->0->>'quantity' from letter_mail_outbox where id=v_job) <> '2' then raise exception 'Earlier confirmation was overwritten'; end if;
  update letter_mail_outbox set status='SENT' where id=v_second_job;
  v_blocked := false;
  begin perform lettershop_change_quantities(gen_random_uuid(),v_order,3,v_number,jsonb_build_array(jsonb_build_object('itemId',v_item,'quantity',0)),v_actor);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'All items were removed'; end if;
  v_blocked := false;
  begin perform lettershop_change_quantities(gen_random_uuid(),v_order,3,v_number,jsonb_build_array(jsonb_build_object('itemId',gen_random_uuid(),'quantity',4)),v_actor);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Foreign item was accepted'; end if;
  insert into letter_production_checklists(batch_id,rows) values(v_batch,'[]'::jsonb);
  v_blocked := false;
  begin perform lettershop_change_quantities(gen_random_uuid(),v_order,3,v_number,jsonb_build_array(jsonb_build_object('itemId',v_item,'quantity',4)),v_actor);
  exception when others then v_blocked := true; end;
  if not v_blocked then raise exception 'Frozen checklist was editable'; end if;
  if (select quantity from letter_order_items where id=v_item) <> 3 or (select revision from letter_orders where id=v_order) <> 3 then raise exception 'Rejected edit changed the order'; end if;
end;
$$;
rollback;
select 'passed, all test records rolled back' as quantity_edit_smoke;
