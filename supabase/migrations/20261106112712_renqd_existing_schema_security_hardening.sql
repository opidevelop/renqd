begin;

revoke all privileges on table public.albums, public.albums_cache, public.artists,
  public.artists_cache, public.featured_items, public.import_jobs, public.tracks,
  public.tracks_cache from anon, authenticated;

revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username) on table public.profiles to authenticated;

drop policy if exists "Users can view all rankings" on public.rankings;
drop policy if exists "rankings_select_all" on public.rankings;
drop policy if exists "rankings_select_own" on public.rankings;
drop policy if exists "rankings_update_own" on public.rankings;
drop policy if exists "rankings_insert_own" on public.rankings;
drop policy if exists "rankings_delete_own" on public.rankings;

create policy rankings_select_own on public.rankings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy rankings_insert_own on public.rankings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy rankings_update_own on public.rankings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy rankings_delete_own on public.rankings
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ranking_tracks_select_related" on public.ranking_tracks;
drop policy if exists "ranking_tracks_select_own" on public.ranking_tracks;
drop policy if exists "ranking_tracks_insert_own" on public.ranking_tracks;
drop policy if exists "ranking_tracks_update_own" on public.ranking_tracks;
drop policy if exists "ranking_tracks_delete_own" on public.ranking_tracks;

create policy ranking_tracks_select_own on public.ranking_tracks
  for select to authenticated using (exists (select 1 from public.rankings r where r.id = renq_id and r.user_id = (select auth.uid())));
create policy ranking_tracks_insert_own on public.ranking_tracks
  for insert to authenticated with check (exists (select 1 from public.rankings r where r.id = renq_id and r.user_id = (select auth.uid())));
create policy ranking_tracks_update_own on public.ranking_tracks
  for update to authenticated using (exists (select 1 from public.rankings r where r.id = renq_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.rankings r where r.id = renq_id and r.user_id = (select auth.uid())));
create policy ranking_tracks_delete_own on public.ranking_tracks
  for delete to authenticated using (exists (select 1 from public.rankings r where r.id = renq_id and r.user_id = (select auth.uid())));

revoke all privileges on table public.rankings, public.ranking_tracks from anon;
grant select, insert, update, delete on table public.rankings, public.ranking_tracks to authenticated;

alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
