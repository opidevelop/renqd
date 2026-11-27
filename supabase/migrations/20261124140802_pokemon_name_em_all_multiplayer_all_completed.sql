create or replace function public.renqd_pokemon_name_em_all_submit_multiplayer_answer(
  p_session_id uuid,p_answer text
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
  v_species public.pokemon_catalog_species%rowtype;
  v_normalized text;
  v_matched_id integer;
  v_scope_user uuid;
  v_assisted boolean;
  v_inserted integer;
  v_found integer;
  v_team_found integer;
  v_errors integer;
  v_total integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_answer is null or length(p_answer)>120 then
    raise exception 'Risposta non valida' using errcode='22023';
  end if;
  v_normalized:=public.normalize_pokemon_answer(p_answer);
  if v_normalized='' then return jsonb_build_object('status','EMPTY'); end if;

  select * into v_session from public.pokemon_name_em_all_sessions
   where id=p_session_id for update;
  if not found or v_session.game_mode not in ('COLLABORATIVE','INDIVIDUAL') then
    raise exception 'Partita non trovata' using errcode='P0002';
  end if;
  select * into v_participant from public.pokemon_name_em_all_participants
   where session_id=p_session_id and user_id=v_user_id and is_active and expelled_at is null for update;
  if not found then raise exception 'Non fai parte della partita' using errcode='42501'; end if;
  if v_participant.completed_at is not null then return jsonb_build_object('status','PLAYER_COMPLETE'); end if;
  if v_session.status='PAUSED' then return jsonb_build_object('status','PAUSED'); end if;
  if v_session.status<>'ACTIVE' then return jsonb_build_object('status','FINISHED'); end if;
  if v_session.started_at is not null and now()<v_session.started_at then return jsonb_build_object('status','COUNTDOWN'); end if;
  if v_session.deadline_at is null or now()>=v_session.deadline_at then return jsonb_build_object('status','TIME_EXPIRED'); end if;

  v_scope_user:=case when v_session.game_mode='COLLABORATIVE' then null else v_user_id end;
  select * into v_species from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases)
     and national_dex=any(v_session.catalog_species_ids)
   limit 1;
  if found then
    if exists(select 1 from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id and species_id=v_species.national_dex
        and ((v_scope_user is null and user_id is null) or user_id=v_scope_user)) then
      return jsonb_build_object('status','ALREADY_FOUND','speciesId',v_species.national_dex,'name',v_species.name_it);
    end if;
    select exists(select 1 from public.pokemon_name_em_all_hints
      where session_id=p_session_id and user_id=v_user_id and species_id=v_species.national_dex and hint_count>0)
      into v_assisted;
    insert into public.pokemon_name_em_all_discoveries(session_id,user_id,discovered_by,species_id,is_assisted)
    values(p_session_id,v_scope_user,v_user_id,v_species.national_dex,v_assisted)
    on conflict do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted=0 then return jsonb_build_object('status','ALREADY_FOUND','speciesId',v_species.national_dex); end if;

    if v_session.game_mode='COLLABORATIVE' then
      select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and discovered_by=v_user_id;
      select count(*) into v_team_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id is null;
    else
      select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id;
      v_team_found:=v_found;
    end if;
    v_total:=cardinality(v_session.catalog_species_ids);
    if v_session.game_mode='INDIVIDUAL' and v_found>=v_total then
      update public.pokemon_name_em_all_participants set completed_at=coalesce(completed_at,now()) where id=v_participant.id;
      if not exists(select 1 from public.pokemon_name_em_all_participants
        where session_id=p_session_id and is_active and expelled_at is null and completed_at is null) then
        return jsonb_build_object('status','ALL_COMPLETED','speciesId',v_species.national_dex,'name',v_species.name_it,
          'foundCount',v_found,'teamFoundCount',v_team_found,'catalogCount',v_total,'assisted',v_assisted);
      end if;
      return jsonb_build_object('status','PLAYER_COMPLETE','speciesId',v_species.national_dex,'name',v_species.name_it,
        'foundCount',v_found,'teamFoundCount',v_team_found,'catalogCount',v_total,'assisted',v_assisted);
    end if;
    if v_session.game_mode='COLLABORATIVE' and v_team_found>=v_total then
      return jsonb_build_object('status','CATALOG_COMPLETE','speciesId',v_species.national_dex,'name',v_species.name_it,
        'foundCount',v_found,'teamFoundCount',v_team_found,'catalogCount',v_total,'assisted',v_assisted);
    end if;
    return jsonb_build_object('status','CORRECT','speciesId',v_species.national_dex,'name',v_species.name_it,
      'foundCount',v_found,'teamFoundCount',v_team_found,'catalogCount',v_total,'assisted',v_assisted);
  end if;

  select national_dex into v_matched_id from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases) limit 1;
  insert into public.pokemon_name_em_all_errors(session_id,user_id,normalized_answer,matched_species_id)
  values(p_session_id,v_user_id,v_normalized,v_matched_id)
  on conflict(session_id,user_id,normalized_answer) do nothing;
  select count(*) into v_errors from public.pokemon_name_em_all_errors where session_id=p_session_id and user_id=v_user_id;
  return jsonb_build_object('status','WRONG','errorsUnique',v_errors,'matchedSpeciesId',v_matched_id);
end;
$$;

revoke all on function public.renqd_pokemon_name_em_all_submit_multiplayer_answer(uuid,text) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_submit_multiplayer_answer(uuid,text) to authenticated;
