begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('renq-covers','renq-covers',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy renq_covers_public_read on storage.objects for select to public using (bucket_id='renq-covers');
create policy renq_covers_owner_insert on storage.objects for insert to authenticated with check (bucket_id='renq-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy renq_covers_owner_update on storage.objects for update to authenticated using (bucket_id='renq-covers' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='renq-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy renq_covers_owner_delete on storage.objects for delete to authenticated using (bucket_id='renq-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
