-- Isolated fixtures; every write is rolled back, including the season closure.
begin;
set local statement_timeout='25s';
do $$
declare actor uuid; photo uuid; product uuid; result jsonb; denied boolean;
begin
 select id into actor from public.profiles where active and lower(role) in ('admin','manager','management') limit 1;
 if actor is null then raise exception 'Requires a management profile'; end if;
 if exists(select 1 from public.holiday_seasons where season='pasen' and (year in(2098,2099) or state<>'closed')) then raise exception 'Fixture edition already exists; do not overwrite'; end if;
 if has_table_privilege('anon','public.holiday_products','SELECT') or has_table_privilege('authenticated','public.holiday_files','SELECT') or has_table_privilege('service_role','public.holiday_files','UPDATE') or has_table_privilege('service_role','public.holiday_products','DELETE') then raise exception 'Unexpected privileges'; end if;
 if not exists(select 1 from storage.buckets where id='holiday-season-files' and public=false and file_size_limit=8388608) then raise exception 'Private photo bucket missing'; end if;
 insert into public.holiday_seasons(season,year,state) values('pasen',2098,'opening');
 insert into public.holiday_files(season,year,kind,name,storage_path,content_type,size) values('pasen',2098,'photo','Fixture photo','fixture/'||gen_random_uuid()||'.jpg','image/jpeg',4) returning id into photo;
 insert into public.holiday_products(season,year,name,price_cents,source_key,photo_id) values('pasen',2098,'Fixture',100,'fixture',photo) returning id into product;
 update public.holiday_products set price_cents=125 where id=product;
 if (select revision from public.holiday_products where id=product)<>2 then raise exception 'Revision did not advance'; end if;
 update public.holiday_seasons set state='closing' where season='pasen' and year=2098;
 result=public.holiday_finish_close('pasen',2098,'{"complete":true,"letters":[],"b2b":[],"mailing":[]}', '{"reviewed":true,"good":"","improve":"","next":"","exceptions":""}',actor);
 if result->>'state'<>'closed' then raise exception 'Closure with separate evaluation failed'; end if;
 if (select central->'assortment'->0->>'price_cents' from public.holiday_archives where season='pasen' and year=2098)<>'125' then raise exception 'Snapshot lost price'; end if;
 if (select central->'seasonFiles'->0->>'id' from public.holiday_archives where season='pasen' and year=2098)<>photo::text then raise exception 'Snapshot lost photo'; end if;
 denied=false;
 begin update public.holiday_products set price_cents=999 where id=product; exception when others then denied=true; end;
 if not denied then raise exception 'Closed product remained writable'; end if;
 insert into public.holiday_seasons(season,year,state) values('pasen',2099,'opening');
 insert into public.holiday_products(season,year,name,price_cents,source_key,photo_id) values('pasen',2099,'Fixture',250,'fixture',photo);
 if (select price_cents from public.holiday_products where id=product)<>125 then raise exception 'New edition changed previous price'; end if;
 denied=false;
 begin update public.holiday_products set year=2099 where id=product; exception when others then denied=true; end;
 if not denied then raise exception 'Product could move out of archive'; end if;
end $$;
rollback;
select 'PASS: private files, exact prices, revision checks, closure without evaluation, complete photo snapshot, immutable previous year; all fixtures rolled back' as result;
