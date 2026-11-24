CREATE OR REPLACE FUNCTION public.renqd_pokemon_name_em_all_leave(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_participant public.pokemon_name_em_all_participants%rowtype;
  v_next_host uuid;
  v_connected integer;
  v_rankings uuid[];
  v_total integer;
  v_team_found integer;
  v_personal_found integer;
  v_found integer;
  v_errors integer;
  v_assisted integer;
  v_completion numeric;
  v_accuracy numeric;
  v_ip_raw numeric;
  v_ip integer;
  v_elapsed integer;
  v_level text;
  v_medal text;
  v_perfect boolean;
  v_visibility text;
  v_username text;
  v_display_name text;
  v_avatar_url text;
  v_slug text;
  v_rank_position integer;
  v_version integer;
  v_discovered_ids integer[];
  v_contributed_ids integer[];
  v_assisted_ids integer[];
  v_generations integer[];
  v_snapshot jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;

  select * into v_session from public.pokemon_name_em_all_sessions
    where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then
    raise exception 'Sessione non disponibile' using errcode='P0002';
  end if;

  select * into v_participant from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_user_id and expelled_at is null
    for update;
  if not found then raise exception 'Non fai parte della partita' using errcode='42501'; end if;

  -- Prima dell'avvio, l'uscita rimuove davvero il partecipante dalla lobby.
  if v_session.status='LOBBY' then
    if v_user_id=v_session.owner_id then
      select coalesce(array_agg(ranking_id),'{}'::uuid[]) into v_rankings
        from public.pokemon_name_em_all_participants where session_id=p_session_id;
      v_rankings:=array_append(v_rankings,v_session.ranking_id);
      delete from public.pokemon_name_em_all_invites where session_id=p_session_id;
      delete from public.pokemon_name_em_all_invite_links where session_id=p_session_id;
      delete from public.pokemon_name_em_all_participants where session_id=p_session_id;
      delete from public.pokemon_name_em_all_sessions where id=p_session_id;
      delete from public.ranking_revisions where ranking_id=any(v_rankings);
      delete from public.rankings where id=any(v_rankings);
      return jsonb_build_object('left',true,'lobby',true,'sessionClosed',true,'partialSaved',false);
    end if;

    update public.pokemon_name_em_all_invites set status='REVOKED',responded_at=now()
      where session_id=p_session_id and invitee_id=v_user_id and status='ACCEPTED';
    delete from public.pokemon_name_em_all_participants where id=v_participant.id;
    delete from public.ranking_revisions where ranking_id=v_participant.ranking_id;
    delete from public.rankings where id=v_participant.ranking_id and user_id=v_user_id;
    if v_session.host_id=v_user_id then
      select user_id into v_next_host from public.pokemon_name_em_all_participants
        where session_id=p_session_id and is_active and is_connected and expelled_at is null
        order by joined_at asc limit 1;
      update public.pokemon_name_em_all_sessions set host_id=v_next_host where id=p_session_id;
    end if;
    return jsonb_build_object('left',true,'lobby',true,'sessionClosed',false,'partialSaved',false);
  end if;

  -- Salvataggio immediato del parziale prima di rimuovere il giocatore dalla classifica attiva.
  v_total:=cardinality(v_session.catalog_species_ids);
  select count(*)::integer into v_team_found
    from public.pokemon_name_em_all_discoveries
    where session_id=p_session_id
      and ((v_session.game_mode='COLLABORATIVE' and user_id is null)
        or (v_session.game_mode='INDIVIDUAL' and user_id=v_user_id));
  select count(*)::integer into v_personal_found
    from public.pokemon_name_em_all_discoveries
    where session_id=p_session_id
      and ((v_session.game_mode='COLLABORATIVE' and user_id is null and discovered_by=v_user_id)
        or (v_session.game_mode='INDIVIDUAL' and user_id=v_user_id));
  v_found:=v_personal_found;

  select count(*)::integer into v_errors from public.pokemon_name_em_all_errors
    where session_id=p_session_id and user_id=v_user_id;
  select count(distinct species_id)::integer into v_assisted from public.pokemon_name_em_all_hints
    where session_id=p_session_id and user_id=v_user_id;

  select coalesce(array_agg(species_id order by species_id),'{}'::integer[]) into v_discovered_ids
    from public.pokemon_name_em_all_discoveries
    where session_id=p_session_id
      and ((v_session.game_mode='COLLABORATIVE' and user_id is null)
        or (v_session.game_mode='INDIVIDUAL' and user_id=v_user_id));
  select coalesce(array_agg(species_id order by species_id),'{}'::integer[]) into v_contributed_ids
    from public.pokemon_name_em_all_discoveries
    where session_id=p_session_id
      and ((v_session.game_mode='COLLABORATIVE' and user_id is null and discovered_by=v_user_id)
        or (v_session.game_mode='INDIVIDUAL' and user_id=v_user_id));
  select coalesce(array_agg(distinct species_id order by species_id),'{}'::integer[]) into v_assisted_ids
    from public.pokemon_name_em_all_hints where session_id=p_session_id and user_id=v_user_id;

  v_completion:=case when v_total=0 then 0 else v_found::numeric/v_total*100 end;
  v_accuracy:=case when v_personal_found+v_errors+v_assisted=0 then 0
    else v_personal_found::numeric/(v_personal_found+v_errors+v_assisted)*100 end;
  v_ip_raw:=v_completion*0.70+v_accuracy*0.30;
  v_ip:=round(v_ip_raw)::integer;
  v_perfect:=v_session.game_mode<>'COLLABORATIVE'
    and v_found=v_total and v_assisted=0 and v_participant.completed_at is not null;
  v_level:=case
    when v_perfect and v_ip=100 then 'Maestro Pokémon'
    when v_ip>=80 then 'Campione'
    when v_ip>=60 then 'Superquattro'
    when v_ip>=40 then 'Capopalestra'
    when v_ip>=20 then 'Allenatore'
    else 'Principiante' end;
  v_medal:=case v_level
    when 'Maestro Pokémon' then 'glaceon'
    when 'Campione' then 'leafeon'
    when 'Superquattro' then 'umbreon'
    when 'Capopalestra' then 'espeon'
    when 'Allenatore' then 'sylveon'
    else 'eevee' end;
  v_elapsed:=greatest(0,extract(epoch from
    (coalesce(v_session.paused_at,now())-coalesce(v_session.started_at,now())))::integer
    -v_session.paused_total_seconds);

  select coalesce(array_agg(distinct s.generation order by s.generation),'{}'::integer[])
    into v_generations
    from public.pokemon_catalog_species s
    where s.national_dex=any(v_discovered_ids)
      and not exists(
        select 1 from public.pokemon_catalog_species other
        where other.national_dex=any(v_session.catalog_species_ids)
          and other.generation=s.generation
          and not (other.national_dex=any(v_discovered_ids))
      );

  select coalesce(default_visibility,'PUBLIC') into v_visibility
    from public.pokemon_name_em_all_preferences where user_id=v_user_id;
  v_visibility:=coalesce(v_visibility,'PUBLIC');
  select coalesce(username,''),coalesce(display_name,username,'Allenatore'),avatar_url
    into v_username,v_display_name,v_avatar_url
    from public.public_profiles where user_id=v_user_id;
  select public_slug into v_slug from public.rankings where id=v_participant.ranking_id;

  with participant_scores as (
    select p.user_id,p.joined_at,
      count(d.species_id)::integer as found_count,
      max(d.discovered_at) as last_discovery_at
    from public.pokemon_name_em_all_participants p
    left join public.pokemon_name_em_all_discoveries d
      on d.session_id=p_session_id
      and ((v_session.game_mode='COLLABORATIVE' and d.user_id is null and d.discovered_by=p.user_id)
        or (v_session.game_mode='INDIVIDUAL' and d.user_id=p.user_id))
    where p.session_id=p_session_id and p.expelled_at is null and p.is_active
    group by p.user_id,p.joined_at
  ), ranked as (
    select user_id,row_number() over(order by found_count desc,last_discovery_at asc nulls last,joined_at asc)::integer as position
    from participant_scores
  )
  select position into v_rank_position from ranked where user_id=v_user_id;

  v_snapshot:=jsonb_build_object(
    'sessionId',p_session_id,'userId',v_user_id,'username',v_username,'displayName',v_display_name,
    'avatarUrl',v_avatar_url,'publicSlug',v_slug,'gameMode',v_session.game_mode,
    'foundCount',v_found,'personalFoundCount',v_personal_found,'contributedCount',v_personal_found,
    'teamFoundCount',v_team_found,'teamCompletion',case when v_total=0 then 0 else round(v_team_found::numeric/v_total*100,2) end,'totalCount',v_total,'catalogCount',v_total,
    'completion',round(v_completion,2),'accuracy',round(v_accuracy)::integer,'accuracyRaw',v_accuracy,
    'errorCount',v_errors,'errorsUnique',v_errors,'assistedCount',v_assisted,'hintCount',v_assisted,
    'performanceIndex',v_ip,'performanceIndexRaw',v_ip_raw,'elapsedSeconds',v_elapsed,
    'level',v_level,'medalKey',v_medal,'perfect',v_perfect,
    'finishReason',case when v_participant.completed_at is not null then 'CATALOG_COMPLETE' else 'PLAYER_LEFT' end,
    'participantStatus','LEFT','partial',v_participant.completed_at is null,
    'rankPosition',coalesce(v_rank_position,0),
    'leaderboard',jsonb_build_array(jsonb_build_object(
      'userId',v_user_id,'username',v_username,'displayName',v_display_name,'avatarUrl',v_avatar_url,
      'publicSlug',v_slug,'foundCount',v_personal_found,'accuracy',round(v_accuracy)::integer,
      'rankPosition',coalesce(v_rank_position,0),'completed',v_participant.completed_at is not null,
      'participantStatus','LEFT','assistedCount',v_assisted,'errorCount',v_errors
    )),
    'generationsCompleted',to_jsonb(v_generations),
    'discoveredSpeciesIds',to_jsonb(v_discovered_ids),
    'contributedSpeciesIds',to_jsonb(v_contributed_ids),
    'assistedSpeciesIds',to_jsonb(v_assisted_ids),
    'catalogSpeciesIds',to_jsonb(v_session.catalog_species_ids),
    'specialSpeciesIds',v_session.special_species_ids,'config',v_session.config,
    'visibility',v_visibility
  );

  update public.pokemon_name_em_all_participants
    set is_active=false,is_connected=false,is_ready=false,left_at=now(),disconnected_at=now()
    where id=v_participant.id;

  if v_session.host_id=v_user_id then
    select user_id into v_next_host from public.pokemon_name_em_all_participants
      where session_id=p_session_id and is_active and is_connected and expelled_at is null
      order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions
      set host_id=v_next_host,host_reclaim_until=null where id=p_session_id;
  end if;

  select count(*) into v_connected from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected=0 and v_session.status='ACTIVE' then
    update public.pokemon_name_em_all_sessions
      set status='PAUSED',remaining_seconds=greatest(0,extract(epoch from (deadline_at-now()))::integer),
          paused_at=now(),deadline_at=null,updated_at=now()
      where id=p_session_id;
  end if;

  insert into public.pokemon_name_em_all_results(session_id,ranking_id,user_id,visibility,result_snapshot,created_at,updated_at)
  values(p_session_id,v_participant.ranking_id,v_user_id,v_visibility,v_snapshot,now(),now())
  on conflict(session_id,user_id) do update
    set ranking_id=excluded.ranking_id,visibility=excluded.visibility,
        result_snapshot=excluded.result_snapshot,updated_at=now(),deleted_at=null;

  update public.rankings
    set status='COMPLETED',completed_at=now(),
      visibility=case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
      settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
        'kind','NAME_EM_ALL','category','games','access',lower(v_visibility),
        'gameMode',v_session.game_mode,'sessionId',p_session_id,'catalogCount',v_total,
        'savedAt',now(),'partial',v_participant.completed_at is null,'resultSnapshot',v_snapshot
      ),
      current_version=current_version+1,updated_at=now()
    where id=v_participant.ranking_id and user_id=v_user_id
    returning current_version into v_version;

  insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
  values(v_participant.ranking_id,v_version,v_user_id,
    jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',jsonb_build_object(
      'resultSnapshot',v_snapshot,'access',lower(v_visibility),'partial',v_participant.completed_at is null
    )),
    'Risultato parziale multiplayer Name ’Em All');

  return jsonb_build_object('left',true,'sessionId',p_session_id,'partialSaved',true,
    'rankingId',v_participant.ranking_id,'resultSnapshot',v_snapshot);
end;
$function$
;

revoke all on function public.renqd_pokemon_name_em_all_leave(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_leave(uuid) to authenticated;
