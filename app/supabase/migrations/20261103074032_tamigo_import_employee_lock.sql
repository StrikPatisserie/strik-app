begin;
create unique index if not exists tamigo_hours_one_employee_inflight
 on public.tamigo_hours_corrections(lower(before_snapshot->>'employeeId'))
 where state in ('applying','unknown') and before_snapshot->>'employeeId' is not null;
create or replace function public.strik_claim_tamigo_hours_correction(p_id uuid,p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare correction public.tamigo_hours_corrections; employee text;
begin
 select * into correction from public.tamigo_hours_corrections where id=p_id for update;
 if not found or correction.actor_id<>p_actor_id then raise exception 'Unknown correction'; end if;
 if correction.state<>'prepared' then return jsonb_build_object('acquired',false,'record',to_jsonb(correction)); end if;
 if correction.expires_at<=now() then raise exception 'Expired correction'; end if;
 employee:=lower(correction.before_snapshot->>'employeeId');
 if employee is null or employee='' then raise exception 'Employee identity missing'; end if;
 perform pg_advisory_xact_lock(hashtextextended('tamigo-import-employee:'||employee,0));
 if exists(select 1 from public.tamigo_hours_corrections c where c.state in ('applying','unknown')
   and (c.shift_id=correction.shift_id or lower(c.before_snapshot->>'employeeId')=employee))
 then raise exception 'A correction for this employee is already in flight or uncertain'; end if;
 update public.tamigo_hours_corrections set state='applying',result_message='Bevestigd door beheerder; bron opnieuw controleren.'
 where id=p_id returning * into correction;
 return jsonb_build_object('acquired',true,'record',to_jsonb(correction));
end;
$$;
revoke all on function public.strik_claim_tamigo_hours_correction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.strik_claim_tamigo_hours_correction(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
