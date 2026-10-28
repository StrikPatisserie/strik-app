begin;

-- Canonical, versioned production documents. Full legacy recipe records are
-- preserved, including unknown fields. Only guarded server adapters can read
-- financial data or mutate documents; no direct browser grants are introduced.
create table if not exists public.production_documents (
  key text primary key check (key in ('recipes', 'planner')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
create table if not exists public.production_document_versions (
  document_key text not null,
  revision bigint not null,
  data jsonb not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (document_key, revision)
);
create table if not exists public.production_migration_backups (
  id uuid primary key default gen_random_uuid(),
  source_hash text not null,
  source_snapshot jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
-- Immutable image bytes are part of the database backup, including offer
-- photos previously linked to WordPress. No public bucket or signed URL.
create table if not exists public.production_media (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  bytes_base64 text not null,
  content_type text not null check(content_type in ('image/jpeg','image/png','image/webp','image/gif')),
  file_name text not null,
  created_at timestamptz not null default now()
);
alter table public.production_documents enable row level security;
alter table public.production_document_versions enable row level security;
alter table public.production_migration_backups enable row level security;
alter table public.production_media enable row level security;
revoke all on public.production_documents, public.production_document_versions, public.production_migration_backups, public.production_media from anon, authenticated;
grant select, insert, update on public.production_documents to service_role;
grant select, insert on public.production_document_versions, public.production_migration_backups to service_role;
grant select, insert on public.production_media to service_role;

-- Store an initial snapshot and subsequent field patches. A checkbox change
-- must not duplicate an entire recipe/photo collection in the audit history.
create or replace function private.production_json_patch(p_old jsonb,p_new jsonb,p_path text[] default array[]::text[])
returns jsonb language plpgsql immutable set search_path='' as $$
declare changes jsonb := '[]'::jsonb; k text; i integer; old_length integer; new_length integer;
begin
  if p_old is not distinct from p_new then return changes; end if;
  if jsonb_typeof(p_old)='object' and jsonb_typeof(p_new)='object' then
    for k in select jsonb_object_keys(p_old) loop
      if not p_new ? k then changes:=changes || jsonb_build_array(jsonb_build_object('op','remove','path',p_path||k)); end if;
    end loop;
    for k in select jsonb_object_keys(p_new) loop
      changes:=changes || private.production_json_patch(p_old->k,p_new->k,p_path||k);
    end loop;
  elsif jsonb_typeof(p_old)='array' and jsonb_typeof(p_new)='array' then
    old_length:=jsonb_array_length(p_old); new_length:=jsonb_array_length(p_new);
    for i in 0..least(old_length,new_length)-1 loop
      changes:=changes || private.production_json_patch(p_old->i,p_new->i,p_path||i::text);
    end loop;
    if old_length>new_length then
      for i in reverse old_length-1..new_length loop changes:=changes || jsonb_build_array(jsonb_build_object('op','remove','path',p_path||i::text)); end loop;
    elsif new_length>old_length then
      for i in old_length..new_length-1 loop changes:=changes || jsonb_build_array(jsonb_build_object('op','set','path',p_path||i::text,'value',p_new->i)); end loop;
    end if;
  else
    changes:=jsonb_build_array(jsonb_build_object('op','set','path',p_path,'value',p_new));
  end if;
  return changes;
end;
$$;
revoke all on function private.production_json_patch(jsonb,jsonb,text[]) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.production_json_patch(jsonb,jsonb,text[]) to service_role;

create or replace function public.production_save_document(p_key text, p_revision bigint, p_data jsonb, p_actor uuid, p_reason text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; current_data jsonb;
begin
  if p_key not in ('recipes', 'planner') or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid-document'; end if;
  select revision,data into current_revision,current_data from public.production_documents where key = p_key for update;
  if current_revision is null or current_revision <> p_revision then raise exception using errcode = '40001', message = 'revision-conflict'; end if;
  if current_data=p_data then return current_revision; end if;
  insert into public.production_document_versions(document_key, revision, data, created_by, reason)
    values(p_key, current_revision + 1, jsonb_build_object('format','patch-v1','changes',private.production_json_patch(current_data,p_data)), p_actor, left(p_reason, 180));
  update public.production_documents set data = p_data, revision = current_revision + 1, updated_at = clock_timestamp(), updated_by = p_actor where key = p_key;
  return current_revision + 1;
end;
$$;
revoke all on function public.production_save_document(text,bigint,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.production_save_document(text,bigint,jsonb,uuid,text) to service_role;

create or replace function public.production_import_wordpress(p_data jsonb, p_planner jsonb, p_snapshot jsonb, p_hash text, p_report jsonb, p_actor uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize first imports. Repeated calls can never overwrite an active store.
  perform pg_advisory_xact_lock(hashtext('strik-production-wordpress-import'));
  if exists(select 1 from public.production_documents where key in ('recipes','planner')) then raise exception using errcode='40001',message='already-imported'; end if;
  if jsonb_typeof(p_data->'recipes') is distinct from 'array' or jsonb_array_length(p_data->'recipes') = 0
    or jsonb_typeof(p_data->'ingredients') is distinct from 'array' or jsonb_typeof(p_planner->'tasks') is distinct from 'array'
    or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_report->>'ready' is distinct from 'true' then raise exception 'invalid-import'; end if;
  insert into public.production_migration_backups(source_hash,source_snapshot,report,created_by) values(p_hash,p_snapshot,p_report,p_actor);
  insert into public.production_documents(key,data,revision,updated_by) values('recipes',p_data,1,p_actor),('planner',p_planner,1,p_actor);
  insert into public.production_document_versions(document_key,revision,data,created_by,reason)
    values('recipes',1,jsonb_build_object('format','snapshot-v1','value',p_data),p_actor,'WordPress-overdracht'),('planner',1,jsonb_build_object('format','snapshot-v1','value',p_planner),p_actor,'Bestaande onderdelen en planning overgenomen');
  return true;
end;
$$;
revoke all on function public.production_import_wordpress(jsonb,jsonb,jsonb,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.production_import_wordpress(jsonb,jsonb,jsonb,text,jsonb,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
