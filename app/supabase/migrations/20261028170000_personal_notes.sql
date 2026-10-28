begin;

-- An explicit allowlist, never the general manager role or editable permissions.
-- Only the confirmed, verified Auth identity is enrolled at the end.
create table if not exists public.personal_workspace_owners (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.personal_workspace_owners enable row level security;
revoke all on public.personal_workspace_owners from anon,authenticated;
grant select on public.personal_workspace_owners to authenticated;
grant all on public.personal_workspace_owners to service_role;
create policy "Read own personal workspace enrolment" on public.personal_workspace_owners
  for select to authenticated using(owner_id=(select auth.uid()));

create or replace function private.is_personal_workspace_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal'='aal2',false)
   and exists(select 1 from public.personal_workspace_owners w where w.owner_id=auth.uid() and w.enabled)
   and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('admin','manager','management'))
   and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end) m
     where m->>'method' in ('totp','mfa/totp')
       and case when m->>'timestamp' ~ '^[0-9]{1,12}$' then (m->>'timestamp')::numeric else 0 end
         > extract(epoch from now())-604800
       and case when m->>'timestamp' ~ '^[0-9]{1,12}$' then (m->>'timestamp')::numeric else 0 end
         <= extract(epoch from now()));
$$;
revoke all on function private.is_personal_workspace_owner() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_personal_workspace_owner() to authenticated;

create table if not exists public.personal_notes (
  id uuid primary key,
  owner_id uuid not null references public.personal_workspace_owners(owner_id) on delete cascade,
  title text not null check(length(title) between 1 and 500),
  notebook text not null check(length(notebook) between 1 and 200),
  body text not null default '' check(length(body)<=500000),
  tags jsonb not null default '[]' check(jsonb_typeof(tags)='array' and jsonb_array_length(tags)<=100),
  attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=200),
  pinned boolean not null default false,
  archived boolean not null default false,
  open_tasks integer not null default 0 check(open_tasks>=0),
  source_hash text check(source_hash is null or source_hash ~ '^[a-f0-9]{64}$'),
  source_created_at timestamptz,
  source_updated_at timestamptz,
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (title || E'\n' || body) stored,
  unique(owner_id,source_hash)
);
create index if not exists personal_notes_owner_updated on public.personal_notes(owner_id,archived,pinned desc,updated_at desc);
alter table public.personal_notes enable row level security;
revoke all on public.personal_notes from anon,authenticated;
grant select,insert,update on public.personal_notes to authenticated;
grant all on public.personal_notes to service_role;
create policy "Only the enrolled owner reads personal notes" on public.personal_notes
 for select to authenticated using(owner_id=(select auth.uid()) and (select private.is_personal_workspace_owner()));
create policy "Only the enrolled owner creates personal notes" on public.personal_notes
 for insert to authenticated with check(owner_id=(select auth.uid()) and (select private.is_personal_workspace_owner()));
create policy "Only the enrolled owner updates personal notes" on public.personal_notes
 for update to authenticated using(owner_id=(select auth.uid()) and (select private.is_personal_workspace_owner()))
 with check(owner_id=(select auth.uid()) and (select private.is_personal_workspace_owner()));

create or replace function public.personal_notebook_names()
returns table(notebook text) language sql stable security invoker set search_path='' as $$
 select distinct n.notebook from public.personal_notes n where n.owner_id=auth.uid() order by n.notebook;
$$;
revoke all on function public.personal_notebook_names() from public,anon;
grant execute on function public.personal_notebook_names() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
 values('personal-notes','personal-notes',false,104857600)
 on conflict(id) do update set public=false,file_size_limit=104857600;
-- Restrictive policies also protect against pre-existing broad storage policies.
create policy "Personal files are never anonymous" on storage.objects as restrictive
 for all to anon using(bucket_id<>'personal-notes') with check(bucket_id<>'personal-notes');
create policy "Personal file owner boundary" on storage.objects as restrictive
 for all to authenticated
 using(bucket_id<>'personal-notes' or (split_part(name,'/',1)=(select auth.uid())::text and (select private.is_personal_workspace_owner())))
 with check(bucket_id<>'personal-notes' or (split_part(name,'/',1)=(select auth.uid())::text and (select private.is_personal_workspace_owner())));
create policy "Read own personal files" on storage.objects for select to authenticated
 using(bucket_id='personal-notes' and split_part(name,'/',1)=(select auth.uid())::text and (select private.is_personal_workspace_owner()));
create policy "Add own personal files" on storage.objects for insert to authenticated
 with check(bucket_id='personal-notes' and split_part(name,'/',1)=(select auth.uid())::text and (select private.is_personal_workspace_owner()));
create policy "Personal source files cannot be overwritten" on storage.objects as restrictive
 for update to authenticated using(bucket_id<>'personal-notes') with check(bucket_id<>'personal-notes');
create policy "Personal source files cannot be deleted" on storage.objects as restrictive
 for delete to authenticated using(bucket_id<>'personal-notes');
-- No overwrite/delete grants: source exports and imported attachments are kept.
-- The account was explicitly confirmed by the user. Resolve its immutable auth
-- ID from verified Auth data, never an editable profile email or display name.
insert into public.personal_workspace_owners(owner_id)
 select p.id from public.profiles p join auth.users u on u.id=p.id
 where lower(u.email)='feline@strik-patisserie.nl' and u.email_confirmed_at is not null
   and p.active and p.role in ('admin','manager','management')
 on conflict(owner_id) do nothing;
notify pgrst,'reload schema';
commit;
