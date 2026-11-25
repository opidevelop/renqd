create or replace function public.renqd_pokemon_name_em_all_delete_solo(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Devi accedere a Renqd';
  end if;
  select * into v_session
    from public.pokemon_name_em_all_sessions
   where id = p_session_id
     and owner_id = v_user_id
     and game_mode = 'SOLO'
     and status in ('ACTIVE','PAUSED')
   for update;
  if not found then
    raise exception 'Partita non eliminabile o non più attiva';
  end if;
  delete from public.rankings
   where id = v_session.ranking_id
     and user_id = v_user_id
     and mode = 'POKEMON_NAME_EM_ALL'
     and status in ('ACTIVE','DRAFT');
  if not found then
    raise exception 'Partita non eliminabile';
  end if;
  return jsonb_build_object('deleted',true);
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_delete_solo(uuid) from public, anon;
grant execute on function public.renqd_pokemon_name_em_all_delete_solo(uuid) to authenticated;
