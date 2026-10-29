-- Run after the migration, from a privileged SQL session. All fixture changes
-- roll back. Requires the enrolled Feline account and a second active manager.
begin;
select set_config('strik.personal_owner',(select owner_id::text from public.personal_workspace_owners where enabled limit 1),true);
select set_config('strik.personal_other',(select id::text from public.profiles where active and role in ('admin','manager','management') and id::text<>current_setting('strik.personal_owner') limit 1),true);
select set_config('strik.personal_note',gen_random_uuid()::text,true);
do $$ begin
 if nullif(current_setting('strik.personal_owner'),'') is null or nullif(current_setting('strik.personal_other'),'') is null then
  raise exception 'Missing enrolled owner or second manager; no access tests were executed';
 end if;
end $$;
insert into public.personal_notes(id,owner_id,title,notebook,body)
 values(current_setting('strik.personal_note')::uuid,current_setting('strik.personal_owner')::uuid,'Fictitious RLS smoke note','Smoke','[ ] Test');
insert into storage.objects(bucket_id,name)
 values('personal-notes',current_setting('strik.personal_owner')||'/smoke/'||current_setting('strik.personal_note'));
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strik.personal_owner'),'role','authenticated','aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
set local role authenticated;
do $$ begin
 if not private.is_personal_workspace_owner() then raise exception 'Owner rejected'; end if;
 if (select count(*) from public.personal_notes where id=current_setting('strik.personal_note')::uuid)<>1 then raise exception 'Owner cannot read own note'; end if;
 if (select count(*) from storage.objects where bucket_id='personal-notes' and name=current_setting('strik.personal_owner')||'/smoke/'||current_setting('strik.personal_note'))<>1 then raise exception 'Owner cannot read own file'; end if;
 update storage.objects set metadata='{}'::jsonb where bucket_id='personal-notes' and name=current_setting('strik.personal_owner')||'/smoke/'||current_setting('strik.personal_note');
 if found then raise exception 'Immutable personal file could be overwritten'; end if;
 begin
  delete from storage.objects where bucket_id='personal-notes' and name=current_setting('strik.personal_owner')||'/smoke/'||current_setting('strik.personal_note');
  if found then raise exception 'Immutable personal file could be deleted'; end if;
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strik.personal_other'),'role','authenticated','aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now())))))::text,true);
set local role authenticated;
do $$ begin
 if private.is_personal_workspace_owner() then raise exception 'Another manager was treated as owner'; end if;
 if exists(select 1 from public.personal_notes) then raise exception 'Another manager can read personal notes'; end if;
 if exists(select 1 from storage.objects where bucket_id='personal-notes') then raise exception 'Another manager can read personal files'; end if;
 begin
  insert into public.personal_notes(id,owner_id,title,notebook) values(gen_random_uuid(),current_setting('strik.personal_owner')::uuid,'Forbidden','Forbidden');
  raise exception 'Another manager can create owner notes';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.personal_workspace_owners(owner_id) values(current_setting('strik.personal_other')::uuid);
  raise exception 'Another manager can enrol themselves';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strik.personal_owner'),'role','authenticated','aal','aal1')::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.personal_notes) then raise exception 'A password-only session can read notes'; end if;
 if exists(select 1 from storage.objects where bucket_id='personal-notes') then raise exception 'A password-only session can read files'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strik.personal_owner'),'role','authenticated','aal','aal2','amr',jsonb_build_array(jsonb_build_object('method','totp','timestamp',floor(extract(epoch from now()))-604801)))::text,true);
set local role authenticated;
do $$ begin
 if private.is_personal_workspace_owner() or exists(select 1 from public.personal_notes) then raise exception 'Expired MFA still grants personal access'; end if;
end $$;
reset role;
rollback;
