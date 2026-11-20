begin;
set local statement_timeout='25s';
do $$
declare actor uuid; cfg jsonb; result jsonb; snapshots integer; denied boolean; before_count integer;
begin
 select id into actor from public.profiles where active and lower(role) in ('admin','manager','management') limit 1;
 if actor is null then raise exception 'Test requires a configured management profile'; end if;
 select count(*) into before_count from public.letter_orders;
 if has_table_privilege('authenticated','public.holiday_archives','SELECT') or has_table_privilege('anon','public.holiday_seasons','SELECT') or has_function_privilege('authenticated','public.holiday_start(text,integer,jsonb,uuid)','EXECUTE') or has_table_privilege('service_role','public.holiday_archives','UPDATE') then raise exception 'Unexpected archive/lifecycle privileges'; end if;
 denied=false;
 begin
  insert into public.letter_production_batches(season,production_date,status) values(2098,'2098-11-01','PLANNED');
 exception when others then denied=true;
 end;
 if not denied then raise exception 'Unconfigured production edition was writable'; end if;
 update public.holiday_seasons set state='closing' where season='sint' and year=2026;
 denied=false;
 begin
  update public.letter_production_batches set production_date=production_date where season=2026;
 exception when others then denied=true;
 end;
 if not denied then raise exception 'Closed production edition was writable'; end if;
 result=public.holiday_finish_close('sint',2026,'{"complete":true,"letters":[],"b2b":[],"mailing":[]}', '{"reviewed":true,"good":"Test","improve":"Test","next":"Test","exceptions":"Transactional test; rolled back"}',actor);
 if result->>'state'<>'closed' then raise exception 'Archive not finalized'; end if;
 if (select jsonb_array_length(central->'orders') from public.holiday_archives where season='sint' and year=2026)<>(select count(*) from public.letter_orders where extract(year from requested_date)=2026) then raise exception 'Incomplete source snapshot'; end if;
 perform public.holiday_finish_close('sint',2026,'{}','{}',actor);
 select count(*) into snapshots from public.holiday_archives where season='sint' and year=2026;
 if snapshots<>1 then raise exception 'Closing retry duplicated archive'; end if;
 cfg='{"owner":"Test","startDate":"2027-10-01","endDate":"2027-12-05","pricesChecked":true,"letters":true,"business":true,"mailing":true,"batches":[{"start":"2027-11-02","date":"2027-11-03","deadline":"2027-11-01T20:00","pickup":"2027-11-05"}]}';
 result=public.holiday_start('sint',2027,cfg,actor);
 perform public.holiday_start('sint',2027,cfg,actor);
 if result->>'state'<>'opening' or (select count(*) from public.letter_production_batches where season=2027)<>1 then raise exception 'New season initialization/retry failed'; end if;
 update public.holiday_seasons set state='active' where season='sint' and year=2027;
 result=public.holiday_start('sint',2027,cfg,actor);
 if result->>'state'<>'active' then raise exception 'Lost opening response cannot be retried'; end if;
 denied=false;
 begin
  update public.letter_production_batches set season=2027 where season=2026;
 exception when others then denied=true;
 end;
 if not denied then raise exception 'Archived data could be moved into another edition'; end if;
 if (select count(*) from public.letter_orders)<>before_count then raise exception 'Original orders changed'; end if;
end $$;
rollback;
select 'PASS: privileges, unconfigured edition guard, closed-tab guard, complete atomic archive, idempotent retries, fresh production rounds, original orders retained; all test writes rolled back' as result;
