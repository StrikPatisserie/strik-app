begin;
-- A recipe change and a planner save must not race between validation and
-- commit. Hold the canonical recipe revision while the existing audited CAS
-- writer saves the entire production plan in one transaction.
create or replace function public.production_save_recipe_plan(p_revision bigint,p_recipe_revision bigint,p_data jsonb,p_actor uuid)
returns bigint language plpgsql security invoker set search_path='' as $$
declare source_revision bigint;
begin
  select revision into source_revision from public.production_documents where key='recipes' for share;
  if source_revision is null or source_revision<>p_recipe_revision then
    raise exception using errcode='40001',message='recipe-revision-conflict';
  end if;
  return public.production_save_document('planner',p_revision,p_data,p_actor,'Productieopdracht met receptberekening; receptrevisie '||p_recipe_revision::text);
end;
$$;
revoke all on function public.production_save_recipe_plan(bigint,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.production_save_recipe_plan(bigint,bigint,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
