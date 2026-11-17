begin;
drop policy if exists account_must_be_approved on public.catalog_entities;
create policy account_must_be_approved on public.catalog_entities
  as restrictive for all to authenticated
  using ((select private.is_approved_user()))
  with check ((select private.is_approved_user()));
commit;
