create or replace function public.renqd_pokemon_name_em_all_can_view(p_ranking_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private,auth
as $$ select private.is_approved_user() and private.can_view_pokemon_name_em_all_result(p_ranking_id); $$;
revoke all on function public.renqd_pokemon_name_em_all_can_view(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_can_view(uuid) to authenticated;
