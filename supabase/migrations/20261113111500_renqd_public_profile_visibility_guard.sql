drop policy if exists rankings_public_completed_select on public.rankings;
create policy rankings_public_completed_select on public.rankings
for select to anon, authenticated
using (status = 'COMPLETED' and visibility = 'LIVE' and coalesce(settings->>'access','public') = 'public'
  and exists (select 1 from public.public_profiles p where p.user_id = rankings.user_id and p.is_private = false));

drop policy if exists ranking_items_public_completed_select on public.ranking_items;
create policy ranking_items_public_completed_select on public.ranking_items
for select to anon, authenticated
using (exists (select 1 from public.rankings r join public.public_profiles p on p.user_id = r.user_id
  where r.id = ranking_items.ranking_id and r.status = 'COMPLETED' and r.visibility = 'LIVE'
  and coalesce(r.settings->>'access','public') = 'public' and p.is_private = false));

drop policy if exists custom_items_public_completed_select on public.custom_items;
create policy custom_items_public_completed_select on public.custom_items
for select to anon, authenticated
using (exists (select 1 from public.ranking_items ri join public.rankings r on r.id = ri.ranking_id
  join public.public_profiles p on p.user_id = r.user_id where ri.custom_item_id = custom_items.id
  and r.status = 'COMPLETED' and r.visibility = 'LIVE' and coalesce(r.settings->>'access','public') = 'public'
  and p.is_private = false));

drop policy if exists ranking_likes_public_count_select on public.ranking_likes;
create policy ranking_likes_public_count_select on public.ranking_likes
for select to anon, authenticated
using (exists (select 1 from public.rankings r join public.public_profiles p on p.user_id = r.user_id
  where r.id = ranking_likes.ranking_id and r.status = 'COMPLETED' and r.visibility = 'LIVE'
  and coalesce(r.settings->>'access','public') = 'public' and p.is_private = false));
