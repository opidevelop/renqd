create or replace function public.renqd_pokemon_name_em_all_finish_multiplayer(
  p_session_id uuid,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_participant public.pokemon_name_em_all_participants%rowtype;
  v_now timestamptz:=now();
  v_end_time timestamptz;
  v_total integer;
  v_team_found integer;
  v_active_count integer;
  v_done_count integer;
  v_found integer;
  v_errors integer;
  v_assisted integer;
  v_generations integer;
  v_completion numeric;
  v_accuracy numeric;
  v_ip numeric;
  v_ip_rounded integer;
  v_elapsed integer;
  v_rank_position integer;
  v_level text;
  v_medal text;
  v_visibility text;
  v_last_discovery timestamptz;
  v_discovered jsonb;
  v_assisted_ids jsonb;
  v_team_ids jsonb;
  v_leaderboard jsonb;
  v_snapshot jsonb;
  v_version integer;
  v_scope_shared boolean;
  v_perfect boolean;
  v_reason text:=p_reason;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.game_mode not in ('COLLABORATIVE','INDIVIDUAL') then
    raise exception 'Sessione non trovata' using errcode='P0002';
  end if;
  if v_session.status not in ('ACTIVE','PAUSED','COMPLETED') then
    raise exception 'La partita non è ancora iniziata' using errcode='22023';
  end if;
  if v_session.status='COMPLETED' then
    select result_snapshot into v_snapshot from public.pokemon_name_em_all_results
      where session_id=p_session_id and user_id=v_user_id and deleted_at is null;
    if v_snapshot is null then raise exception 'Risultato non disponibile' using errcode='P0002'; end if;
    return v_snapshot;
  end if;
  if not exists(select 1 from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_user_id and expelled_at is null) then
    raise exception 'Non fai parte della partita' using errcode='42501';
  end if;

  v_total:=cardinality(v_session.catalog_species_ids);
  v_scope_shared:=v_session.game_mode='COLLABORATIVE';
  if v_reason='ALL_COMPLETED' then v_reason:='CATALOG_COMPLETE'; end if;
  if v_scope_shared then
    select count(*) into v_team_found from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id and user_id is null;
  else
    select count(distinct species_id) into v_team_found from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id;
  end if;
  select count(*) into v_active_count from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and expelled_at is null;
  select count(*) into v_done_count from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and expelled_at is null and completed_at is not null;

  if v_reason='TIMER_EXPIRED' then
    if v_session.deadline_at is null or v_now<v_session.deadline_at then
      raise exception 'Il timer non è ancora scaduto' using errcode='22023';
    end if;
    v_end_time:=v_session.deadline_at;
  elsif v_reason='CATALOG_COMPLETE' then
    if v_scope_shared then
      if v_team_found<v_total then raise exception 'Il Pokédex condiviso non è ancora completo' using errcode='22023'; end if;
      select max(discovered_at) into v_end_time from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and user_id is null;
    else
      if v_active_count=0 or v_done_count<>v_active_count then
        raise exception 'Non tutti i partecipanti attivi hanno completato il catalogo' using errcode='22023';
      end if;
      select max(completed_at) into v_end_time from public.pokemon_name_em_all_participants
        where session_id=p_session_id and is_active and expelled_at is null;
    end if;
  elsif v_reason='HOST_TERMINATED' then
    if v_session.host_id<>v_user_id then
      raise exception 'Solo l’host può terminare la partita' using errcode='42501';
    end if;
    v_end_time:=v_now;
  else
    raise exception 'Motivo di conclusione non valido' using errcode='22023';
  end if;
  v_end_time:=coalesce(v_end_time,v_now);

  update public.pokemon_name_em_all_sessions
    set status='COMPLETED',finish_reason=v_reason,completed_at=v_now,deadline_at=null,
        paused_at=null,updated_at=v_now
    where id=p_session_id;

  if v_scope_shared then
    select coalesce(jsonb_agg(species_id order by discovered_at,species_id),'[]'::jsonb)
      into v_team_ids from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id and user_id is null;
  else
    select coalesce(jsonb_agg(distinct species_id order by species_id),'[]'::jsonb)
      into v_team_ids from public.pokemon_name_em_all_discoveries where session_id=p_session_id;
  end if;

  with found_stats as (
    select p.user_id,count(d.id)::integer as found_count,max(d.discovered_at) as last_discovery_at
    from public.pokemon_name_em_all_participants p
    left join public.pokemon_name_em_all_discoveries d
      on d.session_id=p_session_id
     and ((v_scope_shared and d.discovered_by=p.user_id) or (not v_scope_shared and d.user_id=p.user_id))
    where p.session_id=p_session_id
    group by p.user_id
  ),
  error_stats as (
    select user_id,count(*)::integer as error_count from public.pokemon_name_em_all_errors
    where session_id=p_session_id group by user_id
  ),
  hint_stats as (
    select user_id,count(*) filter(where hint_count>0)::integer as assisted_count
    from public.pokemon_name_em_all_hints where session_id=p_session_id group by user_id
  ),
  base as (
    select p.user_id,p.joined_at,p.completed_at,p.is_active,
      coalesce(pp.display_name,pp.username,'Allenatore') as display_name,
      coalesce(pp.username,'') as username,pp.avatar_url,r.public_slug,p.expelled_at,
      coalesce(f.found_count,0) as found_count,coalesce(e.error_count,0) as error_count,
      coalesce(h.assisted_count,0) as assisted_count,f.last_discovery_at
    from public.pokemon_name_em_all_participants p
    left join public.public_profiles pp on pp.user_id=p.user_id
    left join public.rankings r on r.id=p.ranking_id
    left join found_stats f on f.user_id=p.user_id
    left join error_stats e on e.user_id=p.user_id
    left join hint_stats h on h.user_id=p.user_id
    where p.session_id=p_session_id
  ),
  ranked as (
    select *,row_number() over(order by found_count desc,last_discovery_at asc nulls last,joined_at asc) as rank_position,
      case when found_count+error_count+assisted_count=0 then 0
        else round(found_count::numeric/(found_count+error_count+assisted_count)*100)::integer end as accuracy,
      case when v_total=0 then 0 else round(found_count::numeric/v_total*100,2) end as completion
    from base
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',user_id,'username',username,'displayName',display_name,'avatarUrl',avatar_url,
    'publicSlug',public_slug,'foundCount',found_count,'errorsUnique',error_count,
    'assistedCount',assisted_count,'accuracy',accuracy,'completion',completion,
    'rankPosition',rank_position,'completed',(completed_at is not null or (v_scope_shared and v_reason='CATALOG_COMPLETE')),'isActive',is_active,'expelled',expelled_at is not null
  ) order by rank_position),'[]'::jsonb)
  into v_leaderboard from ranked;

  for v_participant in
    select * from public.pokemon_name_em_all_participants
    where session_id=p_session_id order by joined_at
  loop
    if v_scope_shared then
      select count(*) into v_found from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and discovered_by=v_participant.user_id;
      select max(discovered_at) into v_last_discovery from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and discovered_by=v_participant.user_id;
    else
      select count(*) into v_found from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and user_id=v_participant.user_id;
      select max(discovered_at) into v_last_discovery from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and user_id=v_participant.user_id;
    end if;
    select count(*) into v_errors from public.pokemon_name_em_all_errors
      where session_id=p_session_id and user_id=v_participant.user_id;
    select count(*) filter(where hint_count>0) into v_assisted from public.pokemon_name_em_all_hints
      where session_id=p_session_id and user_id=v_participant.user_id;
    v_completion:=case when v_total=0 then 0 else v_found::numeric/v_total*100 end;
    v_accuracy:=case when v_found+v_errors+v_assisted=0 then 0
      else v_found::numeric/(v_found+v_errors+v_assisted)*100 end;
    v_ip:=v_completion*0.70+v_accuracy*0.30;
    v_ip_rounded:=round(v_ip)::integer;
    v_elapsed:=greatest(0,extract(epoch from (v_end_time-v_session.started_at))::integer-v_session.paused_total_seconds);
    if v_session.game_mode='INDIVIDUAL' then
      v_elapsed:=greatest(0,extract(epoch from (coalesce(v_last_discovery,v_end_time)-v_session.started_at))::integer-v_session.paused_total_seconds);
    end if;
    select (entry->>'rankPosition')::integer into v_rank_position
      from jsonb_array_elements(v_leaderboard) entry
      where entry->>'userId'=v_participant.user_id::text;
    v_perfect:=not v_scope_shared and v_found=v_total and v_assisted=0 and v_participant.completed_at is not null;
    if v_perfect and v_ip_rounded=100 then v_level:='Maestro Pokémon';
    elsif v_ip_rounded>=80 then v_level:='Campione';
    elsif v_ip_rounded>=60 then v_level:='Superquattro';
    elsif v_ip_rounded>=40 then v_level:='Capopalestra';
    elsif v_ip_rounded>=20 then v_level:='Allenatore';
    else v_level:='Principiante'; end if;
    v_medal:=case v_level
      when 'Maestro Pokémon' then 'glaceon' when 'Campione' then 'leafeon'
      when 'Superquattro' then 'umbreon' when 'Capopalestra' then 'espeon'
      when 'Allenatore' then 'sylveon' else 'eevee' end;
    if v_scope_shared then
      select coalesce(jsonb_agg(species_id order by discovered_at,species_id),'[]'::jsonb)
        into v_discovered from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and discovered_by=v_participant.user_id;
    else
      select coalesce(jsonb_agg(species_id order by discovered_at,species_id),'[]'::jsonb)
        into v_discovered from public.pokemon_name_em_all_discoveries
        where session_id=p_session_id and user_id=v_participant.user_id;
    end if;
    select coalesce(jsonb_agg(species_id order by species_id),'[]'::jsonb)
      into v_assisted_ids from public.pokemon_name_em_all_hints
      where session_id=p_session_id and user_id=v_participant.user_id and hint_count>0;
    if v_scope_shared then
      select count(*) into v_generations
      from (select generation,count(*) total from public.pokemon_catalog_species
        where national_dex=any(v_session.catalog_species_ids) group by generation) g
      where g.total=(select count(*) from public.pokemon_name_em_all_discoveries d
        join public.pokemon_catalog_species s on s.national_dex=d.species_id
        where d.session_id=p_session_id and d.user_id is null and s.generation=g.generation);
    else
      select count(*) into v_generations
      from (select generation,count(*) total from public.pokemon_catalog_species
        where national_dex=any(v_session.catalog_species_ids) group by generation) g
      where g.total=(select count(*) from public.pokemon_name_em_all_discoveries d
        join public.pokemon_catalog_species s on s.national_dex=d.species_id
        where d.session_id=p_session_id and d.user_id=v_participant.user_id and s.generation=g.generation);
    end if;
    select coalesce(default_visibility,'PUBLIC') into v_visibility
      from public.pokemon_name_em_all_preferences where user_id=v_participant.user_id;
    v_visibility:=coalesce(v_visibility,'PUBLIC');
    v_snapshot:=jsonb_build_object(
      'score',v_found,'foundCount',v_found,'catalogCount',v_total,
      'completion',round(v_completion,2),'accuracy',round(v_accuracy)::integer,'accuracyRaw',v_accuracy,
      'performanceIndex',v_ip_rounded,'performanceIndexRaw',v_ip,'elapsedSeconds',v_elapsed,
      'errorsUnique',v_errors,'assistedCount',v_assisted,'level',v_level,'medalKey',v_medal,
      'perfect',v_perfect,'finishReason',v_reason,'gameMode',v_session.game_mode,
      'mode',case when v_scope_shared then 'Multiplayer condiviso' else 'Multiplayer individuale' end,
      'rankPosition',coalesce(v_rank_position,0),'leaderboard',v_leaderboard,
      'participantStatus',case when v_participant.expelled_at is not null then 'EXPELLED' when v_participant.completed_at is not null then 'COMPLETED' when v_participant.left_at is not null then 'LEFT' when not v_participant.is_active then 'DISCONNECTED' else 'PARTIAL' end,
      'expelled',v_participant.expelled_at is not null,
      'teamFoundCount',v_team_found,'teamCompletion',case when v_total=0 then 0 else round(v_team_found::numeric/v_total*100,2) end,
      'generationsCompleted',v_generations,'discoveredSpeciesIds',v_discovered,
      'assistedSpeciesIds',v_assisted_ids,'teamDiscoveredSpeciesIds',v_team_ids,
      'catalogSpeciesIds',to_jsonb(v_session.catalog_species_ids),
      'specialSpeciesIds',v_session.special_species_ids,'config',v_session.config
    );
    insert into public.pokemon_name_em_all_results(session_id,ranking_id,user_id,visibility,result_snapshot,created_at,updated_at)
    values(p_session_id,v_participant.ranking_id,v_participant.user_id,v_visibility,v_snapshot,v_now,v_now)
    on conflict(session_id,user_id) do update
      set ranking_id=excluded.ranking_id,visibility=excluded.visibility,
          result_snapshot=excluded.result_snapshot,updated_at=v_now,deleted_at=null;
    update public.rankings
      set status='COMPLETED',
          visibility=case when v_visibility='PUBLIC' then 'LIVE' else 'REVEAL' end,
          settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object(
            'kind','NAME_EM_ALL','category','games','access',lower(v_visibility),
            'gameMode',v_session.game_mode,'sessionId',p_session_id,
            'catalogCount',v_total,'savedAt',v_now,'resultSnapshot',v_snapshot
          ),
          current_version=current_version+1,updated_at=v_now
      where id=v_participant.ranking_id and user_id=v_participant.user_id
      returning current_version into v_version;
    insert into public.ranking_revisions(ranking_id,version,actor_id,snapshot,change_summary)
    values(v_participant.ranking_id,v_version,v_participant.user_id,
      jsonb_build_object('mode','POKEMON_NAME_EM_ALL','settings',jsonb_build_object('resultSnapshot',v_snapshot,'access',lower(v_visibility))),
      'Risultato multiplayer Name ’Em All');
    update public.pokemon_name_em_all_participants
      set is_active=false,is_connected=false,last_seen_at=v_now
      where id=v_participant.id;
  end loop;

  select result_snapshot into v_snapshot from public.pokemon_name_em_all_results
    where session_id=p_session_id and user_id=v_user_id and deleted_at is null;
  return coalesce(v_snapshot,jsonb_build_object('status','COMPLETED','sessionId',p_session_id));
end;
$$;

revoke all on function public.renqd_pokemon_name_em_all_finish_multiplayer(uuid,text) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_finish_multiplayer(uuid,text) to authenticated;
