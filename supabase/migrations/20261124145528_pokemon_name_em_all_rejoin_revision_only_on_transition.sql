create or replace function public.renqd_pokemon_name_em_all_rejoin_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_result jsonb;
  v_ranking_id uuid;
  v_version integer;
  v_needs_rejoin boolean:=false;
  v_participant public.pokemon_name_em_all_participants%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_participant from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_user_id and expelled_at is null for update;
  if found then
    v_needs_rejoin:=not v_participant.is_active or not v_participant.is_connected or v_participant.left_at is not null;
  end if;
  v_result:=private.join_pokemon_name_em_all_session(p_session_id,v_user_id);
  if v_needs_rejoin then
    select ranking_id into v_ranking_id from public.pokemon_name_em_all_participants
      where session_id=p_session_id and user_id=v_user_id and expelled_at is null;
    if v_ranking_id is not null then
      update public.pokemon_name_em_all_results set deleted_at=now(),updated_at=now()
        where session_id=p_session_id and user_id=v_user_id and deleted_at is null;
      update public.rankings set status='ACTIVE',completed_at=null,current_version=current_version+1,updated_at=now()
        where id=v_ranking_id and user_id=v_user_id returning current_version into v_version;
      if v_version is not null then
        insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
        select id,v_version,v_user_id,jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',settings),
          'Rientro in sessione multiplayer Name ’Em All'
        from public.rankings where id=v_ranking_id;
      end if;
    end if;
  end if;
  return v_result;
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_rejoin_session(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_rejoin_session(uuid) to authenticated;
