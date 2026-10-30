-- Match the migration applied by Supabase MCP. Historical imports stay immutable.
alter policy "Personal source files cannot be deleted" on storage.objects
using (bucket_id <> 'personal-notes' or (
 split_part(name,'/',1)=(select auth.uid())::text
 and split_part(name,'/',2)='tasks'
 and (select private.is_personal_workspace_owner())
 and not exists(select 1 from public.personal_notes n where n.owner_id=(select auth.uid())
   and (n.attachments @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))
     or position(storage.objects.name in n.body)>0))
));
create policy "Remove own unreferenced task files" on storage.objects
for delete to authenticated using(
 bucket_id='personal-notes'
 and split_part(name,'/',1)=(select auth.uid())::text
 and split_part(name,'/',2)='tasks'
 and (select private.is_personal_workspace_owner())
 and not exists(select 1 from public.personal_notes n where n.owner_id=(select auth.uid())
   and (n.attachments @> jsonb_build_array(jsonb_build_object('path',storage.objects.name))
     or position(storage.objects.name in n.body)>0))
);
