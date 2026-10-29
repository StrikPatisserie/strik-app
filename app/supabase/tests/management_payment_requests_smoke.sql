begin;
select set_config('strik.payment_smoke',gen_random_uuid()::text,true);
select set_config('strik.payment_actor',(select p.id::text from public.profiles p join auth.users u on u.id=p.id where lower(u.email)='feline@strik-patisserie.nl' and u.email_confirmed_at is not null and p.active limit 1),true);
do $$ begin
 if exists(select 1 from pg_class where oid='public.management_payment_requests'::regclass and not relrowsecurity) then raise exception 'RLS missing'; end if;
 if has_table_privilege('anon','public.management_payment_requests','SELECT') or has_table_privilege('authenticated','public.management_payment_requests','SELECT') or has_table_privilege('authenticated','public.management_payment_requests','INSERT') then raise exception 'Direct browser access is exposed'; end if;
 if has_table_privilege('service_role','public.management_payment_requests','DELETE') then raise exception 'Server can delete payment history'; end if;
end $$;
set local role service_role;
insert into public.management_payment_requests(id,actor_id,recipient_email,amount_cents,description)
 values(current_setting('strik.payment_smoke')::uuid,current_setting('strik.payment_actor')::uuid,'smoke@example.invalid',2550,'Fictitious rollback-only smoke');
do $$ begin
 if not exists(select 1 from public.management_payment_requests where id=current_setting('strik.payment_smoke')::uuid and link_state='creating' and customer_mail_state='pending' and reminder_mail_state='pending' and paid_at is null) then raise exception 'Server create failed'; end if;
 begin
  update public.management_payment_requests set amount_cents=0 where id=current_setting('strik.payment_smoke')::uuid;
  raise exception 'Zero amount accepted';
 exception when check_violation then null; end;
 begin
  insert into public.management_payment_requests(id,actor_id,recipient_email,amount_cents,description)
   values(current_setting('strik.payment_smoke')::uuid,current_setting('strik.payment_actor')::uuid,'smoke@example.invalid',2550,'Duplicate');
  raise exception 'Duplicate request ID accepted';
 exception when unique_violation then null; end;
 if not exists(select 1 from public.management_payment_requests where id=current_setting('strik.payment_smoke')::uuid and mail_version=1 and customer_reminder_mail_state='pending' and followup_mail_state='pending' and customer_reminder_mail_id<>followup_mail_id and customer_reminder_mail_id<>customer_mail_id) then raise exception 'Reminder defaults or distinct receipts missing'; end if;
 begin
  update public.management_payment_requests set paid_at=now(),settlement_method='bank' where id=current_setting('strik.payment_smoke')::uuid;
  raise exception 'Manual payment without actor accepted';
 exception when check_violation then null; end;
 update public.management_payment_requests set paid_at=now(),settlement_method='store',manual_paid_by=current_setting('strik.payment_actor')::uuid,manual_paid_note='Rollback-only audit check' where id=current_setting('strik.payment_smoke')::uuid;
 begin
  update public.management_payment_requests set customer_reminder_sent_at=now(),customer_reminder_due_at=now()+interval '6 days' where id=current_setting('strik.payment_smoke')::uuid;
  raise exception 'Shortened reminder deadline accepted';
 exception when check_violation then null; end;
 update public.management_payment_requests set customer_reminder_sent_at=now(),customer_reminder_due_at=now()+interval '7 days' where id=current_setting('strik.payment_smoke')::uuid;
end $$;
reset role;
select true as payment_smoke_passed;
rollback;
