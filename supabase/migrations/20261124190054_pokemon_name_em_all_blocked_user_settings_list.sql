create or replace function public.renqd_list_blocked_users()
returns table(user_id uuid,username text,display_name text,avatar_url text)
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
  select b.blocked_id,coalesce(p.username,''),coalesce(p.display_name,p.username,'Utente Renqd'),p.avatar_url
  from public.user_blocks b
  left join public.public_profiles p on p.user_id=b.blocked_id
  where b.blocker_id=(select auth.uid())
    and private.is_approved_user()
  order by coalesce(p.display_name,p.username,'') collate "C";
$$;
revoke all on function public.renqd_list_blocked_users() from public,anon;
grant execute on function public.renqd_list_blocked_users() to authenticated;
