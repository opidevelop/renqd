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
revoke update on public.ranking_comments from authenticated;
grant update(body,edited_at,deleted_at) on public.ranking_comments to authenticated;
commit;
