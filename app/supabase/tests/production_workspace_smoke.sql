-- Run after the schema and before first import. Everything rolls back.
begin;
do $$
declare before_value jsonb; after_value jsonb; reconstructed jsonb; patch jsonb; change jsonb; path text[]; revision bigint;
begin
  if exists(select 1 from public.production_documents) then raise exception 'Smoke test is only for the empty, pre-import store'; end if;
  if has_table_privilege('anon','public.production_documents','select') or has_table_privilege('authenticated','public.production_documents','select')
    or has_table_privilege('authenticated','public.production_migration_backups','select') or has_table_privilege('anon','public.production_media','select') then raise exception 'Direct data access is not closed'; end if;
  if has_function_privilege('authenticated','public.production_save_document(text,bigint,jsonb,uuid,text)','execute') then raise exception 'Direct document writes are not closed'; end if;
  for before_value,after_value in select * from (values
    ('{"tasks":[{"id":"one","status":"planned"}],"note":"keep"}'::jsonb,'{"tasks":[{"id":"one","status":"done"},{"id":"two"}],"note":"keep"}'::jsonb),
    ('{"list":[1,2,3],"removed":true}'::jsonb,'{"list":[4],"added":{"value":5}}'::jsonb),
    ('{"list":[]}'::jsonb,'{"list":[1]}'::jsonb),
    ('{"list":[1]}'::jsonb,'{"list":[]}'::jsonb)
  ) as cases(old_value,new_value) loop
    patch:=private.production_json_patch(before_value,after_value);
    reconstructed:=before_value;
    for change in select * from jsonb_array_elements(patch) loop
      select array_agg(v order by ord) into path from jsonb_array_elements_text(change->'path') with ordinality as p(v,ord);
      if change->>'op'='remove' then reconstructed:=reconstructed #- path;
      elsif coalesce(array_length(path,1),0)=0 then reconstructed:=change->'value';
      else reconstructed:=jsonb_set(reconstructed,path,change->'value',true); end if;
    end loop;
    if reconstructed<>after_value then raise exception 'Audit patch cannot reconstruct original change'; end if;
  end loop;
  insert into public.production_documents(key,data,revision) values('planner','{"tasks":[]}',1);
  revision:=public.production_save_document('planner',1,'{"tasks":[],"checked":true}',null,'Smoke test');
  if revision<>2 then raise exception 'Revision was not incremented'; end if;
  begin
    perform public.production_save_document('planner',1,'{"overwrite":true}',null,'Stale write');
    raise exception 'Stale write was accepted';
  exception when serialization_failure then null; end;
  if (select data->>'checked' from public.production_documents where key='planner')<>'true' then raise exception 'Stale write changed data'; end if;
end;
$$;
rollback;
select 'production schema, private access, audit reconstruction and conflict checks passed' as result;
