begin;
do $$
declare r bigint; p bigint; payload jsonb; before_count bigint; after_count bigint; saved bigint;
begin
  if has_function_privilege('anon','public.production_save_recipe_plan(bigint,bigint,jsonb,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.production_save_recipe_plan(bigint,bigint,jsonb,uuid)','EXECUTE') then
    raise exception 'Recipe planning write function is not private';
  end if;
  select revision into r from public.production_documents where key='recipes';
  select revision,data into p,payload from public.production_documents where key='planner';
  if r is null or p is null then raise exception 'Live production documents are required for this rollback check'; end if;
  select count(*) into before_count from public.production_document_versions;
  begin
    perform public.production_save_recipe_plan(p,r-1,payload,null);
    raise exception 'A stale recipe revision was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.production_save_recipe_plan(p-1,r,payload,null);
    raise exception 'A stale planner revision was accepted';
  exception when serialization_failure then null;
  end;
  saved:=public.production_save_recipe_plan(p,r,payload,null);
  select count(*) into after_count from public.production_document_versions;
  if saved<>p or after_count<>before_count then raise exception 'No-op plan check changed production data'; end if;
end $$;
select 'recipe and planner revisions, private access and unchanged live records verified' as result;
rollback;
