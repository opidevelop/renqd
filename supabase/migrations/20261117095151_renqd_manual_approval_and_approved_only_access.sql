begin;

-- Email verification remains enabled; it must not grant platform approval.
drop trigger if exists on_auth_user_email_verified on auth.users;
drop function if exists public.handle_verified_user_email();

-- The approval helper is internal and callable only by authenticated users.
revoke all on function private.is_approved_user() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_approved_user() to authenticated;

-- Profiles, collections and their contents are available only to approved accounts.
do $$
declare
  t text;
begin
  foreach t in array array['public_profiles','profile_collections','profile_collection_items']
  loop
    execute format('drop policy if exists account_must_be_approved on public.%I', t);
    execute format(
      'create policy account_must_be_approved on public.%I as restrictive for all to authenticated using ((select private.is_approved_user())) with check ((select private.is_approved_user()))',
      t
    );
  end loop;
end
$$;

revoke all privileges on table public.public_profiles, public.profile_collections, public.profile_collection_items from anon;

drop policy if exists public_profiles_read_visible on public.public_profiles;
drop policy if exists public_profiles_read_approved on public.public_profiles;
create policy public_profiles_read_approved on public.public_profiles
  for select to authenticated
  using ((select private.is_approved_user()) and (user_id = (select auth.uid()) or is_private = false));

drop policy if exists profile_collections_read_visible on public.profile_collections;
drop policy if exists profile_collections_read_approved on public.profile_collections;
create policy profile_collections_read_approved on public.profile_collections
  for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      owner_id = (select auth.uid())
      or (
        visibility = 'PUBLIC'
        and exists (
          select 1 from public.public_profiles p
          where p.user_id = profile_collections.owner_id and p.is_private = false
        )
      )
    )
  );

drop policy if exists profile_collection_items_read_visible on public.profile_collection_items;
drop policy if exists profile_collection_items_read_approved on public.profile_collection_items;
create policy profile_collection_items_read_approved on public.profile_collection_items
  for select to authenticated
  using (
    (select private.is_approved_user())
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1
        from public.profile_collections c
        join public.public_profiles p on p.user_id = c.owner_id
        where c.id = profile_collection_items.collection_id
          and c.visibility = 'PUBLIC'
          and p.is_private = false
      )
    )
  );

-- Publicly shared rankings remain visible to approved members, never to anon.
drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select on public.rankings
  for select to authenticated
  using (
    status = 'COMPLETED'
    and visibility = 'LIVE'
    and coalesce(settings->>'access','public') = 'public'
    and exists (
      select 1 from public.public_profiles p
      where p.user_id = rankings.user_id and p.is_private = false
    )
  );

drop policy if exists ranking_items_public_completed_select on public.ranking_items;
create policy ranking_items_public_completed_select on public.ranking_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.rankings r
      join public.public_profiles p on p.user_id = r.user_id
      where r.id = ranking_items.ranking_id
        and r.status = 'COMPLETED'
        and r.visibility = 'LIVE'
        and coalesce(r.settings->>'access','public') = 'public'
        and p.is_private = false
    )
  );

drop policy if exists custom_items_public_completed_select on public.custom_items;
create policy custom_items_public_completed_select on public.custom_items
  for select to authenticated
  using (
    exists (
      select 1
      from public.ranking_items ri
      join public.rankings r on r.id = ri.ranking_id
      join public.public_profiles p on p.user_id = r.user_id
      where ri.custom_item_id = custom_items.id
        and r.status = 'COMPLETED'
        and r.visibility = 'LIVE'
        and coalesce(r.settings->>'access','public') = 'public'
        and p.is_private = false
    )
  );

drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select on public.ranking_likes
  for select to authenticated
  using (
    exists (
      select 1
      from public.rankings r
      join public.public_profiles p on p.user_id = r.user_id
      where r.id = ranking_likes.ranking_id
        and r.status = 'COMPLETED'
        and r.visibility = 'LIVE'
        and coalesce(r.settings->>'access','public') = 'public'
        and p.is_private = false
    )
  );

-- Private Storage: all objects now require an approved authenticated account.
update storage.buckets set public = false where id = 'profile-media';
drop policy if exists profile_media_public_read on storage.objects;
drop policy if exists profile_media_approved_read on storage.objects;
create policy profile_media_approved_read on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-media' and (select private.is_approved_user()));

drop policy if exists storage_account_must_be_approved on storage.objects;
create policy storage_account_must_be_approved on storage.objects
  as restrictive for all to authenticated
  using ((select private.is_approved_user()))
  with check ((select private.is_approved_user()));

commit;
