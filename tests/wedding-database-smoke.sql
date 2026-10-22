-- Run in the SQL editor. Every synthetic booking and setting is rolled back.
-- No mail worker can observe these uncommitted jobs.
begin;
do $$
declare
  actor uuid;
  day date := (now() at time zone 'Europe/Amsterdam')::date + 21;
  customer jsonb := '{"names":"SQL test — rollback","email":"test@example.com","phone":"0612345678","weddingDate":"","guests":"","notes":"Synthetic, rolled back"}'::jsonb;
  request_id uuid := gen_random_uuid();
  first jsonb;
  repeated jsonb;
  manual jsonb;
  raised boolean;
begin
  select id into actor from auth.users limit 1;
  while extract(dow from day)::integer not in (2,3,4,5,6) loop day := day+1; end loop;
  update wedding_booking_settings set enabled=true where singleton;
  insert into wedding_appointment_blocks(block_date,source_id) values(day,'wordpress:rollback-test');
  raised:=false;
  begin perform strik_book_wedding_appointment(day,'10:30',request_id,customer,repeat('a',64)); exception when sqlstate 'P0001' then raised:=true; end;
  assert raised, 'blocked day allowed a booking';
  update wedding_appointment_blocks set active=false where source_id='wordpress:rollback-test';
  first := strik_book_wedding_appointment(day,'10:30',request_id,customer,repeat('a',64));
  repeated := strik_book_wedding_appointment(day,'10:30',request_id,customer,repeat('a',64));
  assert first->>'id'=repeated->>'id', 'retry created a duplicate';
  assert (select count(*) from wedding_appointment_mail_outbox where appointment_id=(first->>'id')::uuid)=3, 'missing atomic mail jobs';
  assert (select available_at from wedding_appointment_mail_outbox where appointment_id=(first->>'id')::uuid and template='CUSTOMER_REMINDER')=((day-1)+time '08:00') at time zone 'Europe/Amsterdam', 'wrong reminder day';
  raised:=false;
  begin perform strik_book_wedding_appointment(day,'10:30',gen_random_uuid(),customer,repeat('b',64)); exception when sqlstate 'P0001' then raised:=true; end;
  assert raised, 'double booking allowed';
  raised:=false;
  begin perform strik_book_wedding_appointment(day,'10:30',request_id,customer||'{"names":"Changed"}',repeat('a',64)); exception when sqlstate 'P0001' then raised:=true; end;
  assert raised, 'changed retry allowed';
  raised:=false;
  begin perform strik_manage_wedding_appointment(null,gen_random_uuid(),day,'10:45','11:15',customer,'confirmed',true,actor,null); exception when sqlstate 'P0001' then raised:=true; end;
  assert raised, 'staff overlap allowed';
  -- Sunday evening is unavailable publicly but may be booked by staff.
  manual := strik_manage_wedding_appointment(null,gen_random_uuid(),day+(7-extract(dow from day)::integer),'16:15','17:00',customer,'confirmed',true,actor,null);
  assert manual->>'start_time'='16:15:00', 'staff time was restricted';
  raised:=false;
  begin perform strik_manage_wedding_appointment((manual->>'id')::uuid,null,(manual->>'appointment_date')::date,'16:15','17:00',customer,'cancelled',false,actor,99); exception when sqlstate 'P0001' then raised:=true; end;
  assert raised, 'stale update allowed';
  perform strik_manage_wedding_appointment((first->>'id')::uuid,null,day,'10:30','11:00',customer,'cancelled',false,actor,1);
  assert (select count(*) from wedding_appointment_mail_outbox where appointment_id=(first->>'id')::uuid and status='PENDING')=0, 'cancelled mail remained active';
  perform strik_book_wedding_appointment(day,'10:30',gen_random_uuid(),customer,repeat('c',64));
  assert not has_table_privilege('anon','public.wedding_appointments','SELECT'), 'anonymous customer data exposed';
  assert not has_function_privilege('authenticated','public.strik_book_wedding_appointment(date,time,uuid,jsonb,text)','EXECUTE'), 'RPC accessible outside server';
end;
$$;
rollback;
select 'Passed: slot conflicts, retry deduplication, reminders, staff times, cancellation, revision checks and private access. All test data rolled back.' as result;
