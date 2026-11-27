begin;
update storage.buckets set public=false where id='renq-covers';
drop policy if exists renq_covers_public_read on storage.objects;
create policy renq_covers_owner_read on storage.objects for select to authenticated using (bucket_id='renq-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
