create or replace function public.renqd_pokemon_name_em_all_update_lobby_config(
  p_session_id uuid,p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_temp public.pokemon_name_em_all_sessions%rowtype;
  v_result jsonb;
  v_config jsonb;
  v_temp_session_id uuid;
  v_temp_ranking_id uuid;
  v_count integer;
  v_game_mode text;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status<>'LOBBY' or v_session.owner_id<>v_user_id then
    raise exception 'Solo il creatore può modificare la configurazione della lobby' using errcode='42501';
  end if;
  v_game_mode:=coalesce(p_config->>'mode',v_session.game_mode);
  if v_game_mode not in ('COLLABORATIVE','INDIVIDUAL') then raise exception 'Modalità multiplayer non valida' using errcode='22023'; end if;
  v_config:=coalesce(p_config,'{}'::jsonb)||jsonb_build_object('mode',v_game_mode);
  v_result:=public.renqd_pokemon_name_em_all_create_solo(v_config||jsonb_build_object('mode','SOLO'));
  v_temp_session_id:=(v_result->>'sessionId')::uuid;
  select * into v_temp from public.pokemon_name_em_all_sessions where id=v_temp_session_id;
  if not found then raise exception 'Impossibile ricostruire il catalogo' using errcode='P0002'; end if;
  v_temp_ranking_id:=v_temp.ranking_id;

  update public.pokemon_name_em_all_sessions
    set config=v_config,game_mode=v_game_mode,catalog_species_ids=v_temp.catalog_species_ids,
      special_species_ids=v_temp.special_species_ids,duration_seconds=v_temp.duration_seconds,
      remaining_seconds=v_temp.duration_seconds,started_at=null,deadline_at=null,paused_at=null,
      paused_total_seconds=0,updated_at=now()
    where id=p_session_id;

  update public.pokemon_name_em_all_participants
    set catalog_order=case
      when v_game_mode='INDIVIDUAL' and coalesce(v_config->>'sortOrder','RANDOM')='RANDOM'
        then (select array_agg(species_id order by random()) from unnest(v_temp.catalog_species_ids) as u(species_id))
      else v_temp.catalog_species_ids end,
      is_ready=false
    where session_id=p_session_id;

  update public.rankings
    set participation_mode='COLLAB',settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
      'config',v_config,'gameMode',v_game_mode,'catalogCount',cardinality(v_temp.catalog_species_ids)
    ),updated_at=now()
    where id in(select ranking_id from public.pokemon_name_em_all_participants where session_id=p_session_id);
  update public.ranking_revisions rr
    set snapshot=jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',r.settings),
        change_summary='Configurazione lobby aggiornata'
    from public.rankings r
    where rr.ranking_id=r.id and rr.version=r.current_version
      and r.id in(select ranking_id from public.pokemon_name_em_all_participants where session_id=p_session_id);

  delete from public.pokemon_name_em_all_sessions where id=v_temp_session_id;
  delete from public.ranking_revisions where ranking_id=v_temp_ranking_id;
  delete from public.rankings where id=v_temp_ranking_id;
  return jsonb_build_object('sessionId',p_session_id,'status','LOBBY','gameMode',v_game_mode,
    'catalogCount',cardinality(v_temp.catalog_species_ids),'durationSeconds',v_temp.duration_seconds);
end;
$$;