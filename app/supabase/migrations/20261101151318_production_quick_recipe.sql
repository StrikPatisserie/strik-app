begin;
create or replace function public.production_save_quick_recipe(p_revision bigint,p_recipe_revision bigint,p_planner jsonb,p_recipes jsonb,p_actor uuid)
returns bigint language plpgsql security invoker set search_path='' as $$
declare current_recipe bigint; current_planner bigint;
begin
 select revision into current_recipe from public.production_documents where key='recipes' for update;
 select revision into current_planner from public.production_documents where key='planner' for update;
 if current_recipe is distinct from p_recipe_revision or current_planner is distinct from p_revision then
  raise exception using errcode='40001',message='production-revision-conflict';
 end if;
 perform public.production_save_document('recipes',p_recipe_revision,p_recipes,p_actor,'Werkrecept snel ingevoerd vanuit productieplanning');
 return public.production_save_document('planner',p_revision,p_planner,p_actor,'Werkrecept gekoppeld aan bestaand productieonderdeel');
end;
$$;
revoke all on function public.production_save_quick_recipe(bigint,bigint,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.production_save_quick_recipe(bigint,bigint,jsonb,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
