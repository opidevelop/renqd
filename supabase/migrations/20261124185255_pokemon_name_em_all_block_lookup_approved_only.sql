create or replace function public.renqd_is_user_blocked(p_other_user_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$ select private.is_approved_user() and private.is_user_blocked_with(p_other_user_id); $$;
revoke all on function public.renqd_is_user_blocked(uuid) from public,anon;
grant execute on function public.renqd_is_user_blocked(uuid) to authenticated;
