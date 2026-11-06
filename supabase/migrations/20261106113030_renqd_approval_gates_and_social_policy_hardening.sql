begin;
create or replace function private.is_approved_user() returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='APPROVED')
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_approved_user() to authenticated;
do $$
declare t text;
begin
 foreach t in array array['rankings','ranking_tracks','custom_items','ranking_items','ranking_participants','ranking_results','ranking_revisions','ranking_battle_sessions','ranking_battle_comparisons','ranking_speed_sessions','ranking_messages','ranking_activity','user_follows','user_blocks','ranking_likes','ranking_comments','user_notifications']
 loop
  execute format('drop policy if exists account_must_be_approved on public.%I',t);
  execute format('create policy account_must_be_approved on public.%I as restrictive for all to authenticated using ((select private.is_approved_user())) with check ((select private.is_approved_user()))',t);
 end loop;
end $$;
drop policy if exists follows_participant_access on public.user_follows;
drop policy if exists ranking_likes_insert_self on public.ranking_likes;
create policy ranking_likes_insert_member on public.ranking_likes for insert to authenticated with check(user_id=(select auth.uid()) and (exists(select 1 from public.rankings r where r.id=ranking_likes.ranking_id and r.user_id=(select auth.uid())) or exists(select 1 from public.ranking_participants p where p.ranking_id=ranking_likes.ranking_id and p.user_id=(select auth.uid()) and p.invitation_status='ACCEPTED')));
revoke update on public.ranking_comments from authenticated;
grant update(body,edited_at,deleted_at) on public.ranking_comments to authenticated;
commit;
