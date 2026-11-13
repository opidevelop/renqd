begin;
create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  website_url text,
  location text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_profiles_username_format check (username ~ '^[A-Za-z0-9_.-]{3,30}$'),
  constraint public_profiles_bio_length check (char_length(bio) <= 280)
);
insert into public.public_profiles(user_id, username, display_name)
select id, username, username from public.profiles on conflict (user_id) do nothing;
create table if not exists public.profile_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 70),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 240),
  banner_url text,
  visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC','PRIVATE')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_collections_owner_order_idx on public.profile_collections(owner_id, sort_order, created_at desc);
create table if not exists public.profile_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.profile_collections(id) on delete cascade,
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(collection_id, ranking_id)
);
create index if not exists profile_collection_items_collection_position_idx on public.profile_collection_items(collection_id, position, created_at);
alter table public.public_profiles enable row level security;
alter table public.profile_collections enable row level security;
alter table public.profile_collection_items enable row level security;
drop policy if exists public_profiles_read_visible on public.public_profiles;
create policy public_profiles_read_visible on public.public_profiles for select to anon, authenticated using (user_id = (select auth.uid()) or is_private = false);
drop policy if exists public_profiles_insert_self on public.public_profiles;
create policy public_profiles_insert_self on public.public_profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists public_profiles_update_self on public.public_profiles;
create policy public_profiles_update_self on public.public_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists profile_collections_read_visible on public.profile_collections;
create policy profile_collections_read_visible on public.profile_collections for select to anon, authenticated using (owner_id = (select auth.uid()) or (visibility = 'PUBLIC' and exists (select 1 from public.public_profiles p where p.user_id = profile_collections.owner_id and p.is_private = false)));
drop policy if exists profile_collections_insert_self on public.profile_collections;
create policy profile_collections_insert_self on public.profile_collections for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists profile_collections_update_self on public.profile_collections;
create policy profile_collections_update_self on public.profile_collections for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists profile_collections_delete_self on public.profile_collections;
create policy profile_collections_delete_self on public.profile_collections for delete to authenticated using (owner_id = (select auth.uid()));
drop policy if exists profile_collection_items_read_visible on public.profile_collection_items;
create policy profile_collection_items_read_visible on public.profile_collection_items for select to anon, authenticated using (owner_id = (select auth.uid()) or exists (select 1 from public.profile_collections c join public.public_profiles p on p.user_id = c.owner_id where c.id = profile_collection_items.collection_id and c.visibility = 'PUBLIC' and p.is_private = false));
drop policy if exists profile_collection_items_insert_owner on public.profile_collection_items;
create policy profile_collection_items_insert_owner on public.profile_collection_items for insert to authenticated with check (owner_id = (select auth.uid()) and exists (select 1 from public.profile_collections c where c.id = profile_collection_items.collection_id and c.owner_id = (select auth.uid())) and exists (select 1 from public.rankings r where r.id = profile_collection_items.ranking_id and r.user_id = (select auth.uid()) and r.status = 'COMPLETED'));
drop policy if exists profile_collection_items_delete_owner on public.profile_collection_items;
create policy profile_collection_items_delete_owner on public.profile_collection_items for delete to authenticated using (owner_id = (select auth.uid()));
grant select, insert, update on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
grant select, insert, update, delete on public.profile_collections to authenticated;
grant select on public.profile_collections to anon;
grant select, insert, delete on public.profile_collection_items to authenticated;
grant select on public.profile_collection_items to anon;
drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select on public.rankings for select to anon, authenticated using (status = 'COMPLETED' and visibility = 'LIVE' and coalesce(settings->>'access','public') = 'public');
drop policy if exists ranking_items_public_completed_select on public.ranking_items;
create policy ranking_items_public_completed_select on public.ranking_items for select to anon, authenticated using (exists (select 1 from public.rankings r where r.id = ranking_items.ranking_id and r.status = 'COMPLETED' and r.visibility = 'LIVE' and coalesce(r.settings->>'access','public') = 'public'));
drop policy if exists custom_items_public_completed_select on public.custom_items;
create policy custom_items_public_completed_select on public.custom_items for select to anon, authenticated using (exists (select 1 from public.ranking_items ri join public.rankings r on r.id = ri.ranking_id where ri.custom_item_id = custom_items.id and r.status = 'COMPLETED' and r.visibility = 'LIVE' and coalesce(r.settings->>'access','public') = 'public'));
drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select on public.ranking_likes for select to anon, authenticated using (exists (select 1 from public.rankings r where r.id = ranking_likes.ranking_id and r.status = 'COMPLETED' and r.visibility = 'LIVE' and coalesce(r.settings->>'access','public') = 'public'));
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media','profile-media',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'profile-media');
drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects for update to authenticated using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists profile_media_delete_own on storage.objects;
create policy profile_media_delete_own on storage.objects for delete to authenticated using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;