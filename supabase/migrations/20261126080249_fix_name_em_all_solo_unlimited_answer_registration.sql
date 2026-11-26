create or replace function public.renqd_pokemon_name_em_all_submit_answer(p_session_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_normalized text;
  v_species public.pokemon_catalog_species%rowtype;
  v_matched_id integer;
  v_inserted integer;
  v_found integer;
  v_errors integer;
  v_already boolean;
  v_assisted boolean;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  if p_answer is null or length(p_answer)>120 then raise exception 'Risposta non valida' using errcode='22023'; end if;
  v_normalized := public.normalize_pokemon_answer(p_answer);
  if v_normalized='' then return jsonb_build_object('status','EMPTY'); end if;
  select * into v_session from public.pokemon_name_em_all_sessions
    where id=p_session_id and owner_id=v_user_id for update;
  if not found or v_session.game_mode<>'SOLO' then raise exception 'Partita non trovata' using errcode='P0002'; end if;
  if v_session.status='PAUSED' then return jsonb_build_object('status','PAUSED'); end if;
  if v_session.status<>'ACTIVE' then return jsonb_build_object('status','FINISHED'); end if;
  if v_session.duration_seconds<>0 and (v_session.deadline_at is null or now()>=v_session.deadline_at) then
    return jsonb_build_object('status','TIME_EXPIRED');
  end if;

  select * into v_species from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases)
     and national_dex=any(v_session.catalog_species_ids)
   limit 1;
  if found then
    select exists(select 1 from public.pokemon_name_em_all_discoveries
      where session_id=p_session_id and user_id=v_user_id and species_id=v_species.national_dex) into v_already;
    if v_already then
      return jsonb_build_object('status','ALREADY_FOUND','speciesId',v_species.national_dex,'name',v_species.name_it);
    end if;
    select exists(select 1 from public.pokemon_name_em_all_hints
      where session_id=p_session_id and user_id=v_user_id and species_id=v_species.national_dex and hint_count>0) into v_assisted;
    insert into public.pokemon_name_em_all_discoveries(session_id,user_id,species_id,discovered_by,is_assisted)
    values(p_session_id,v_user_id,v_species.national_dex,v_user_id,v_assisted)
    on conflict do nothing;
    get diagnostics v_inserted=row_count;
    select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id;
    select count(*) into v_errors from public.pokemon_name_em_all_errors where session_id=p_session_id and user_id=v_user_id;
    return jsonb_build_object('status',case when v_inserted=1 then 'CORRECT' else 'ALREADY_FOUND' end,
      'speciesId',v_species.national_dex,'name',v_species.name_it,
      'foundCount',v_found,'catalogCount',cardinality(v_session.catalog_species_ids),
      'errorsUnique',v_errors,'assisted',v_assisted,
      'completed',v_found=cardinality(v_session.catalog_species_ids));
  end if;

  select national_dex into v_matched_id from public.pokemon_catalog_species
   where v_normalized=any(normalized_aliases) limit 1;
  insert into public.pokemon_name_em_all_errors(session_id,user_id,normalized_answer,matched_species_id)
  values(p_session_id,v_user_id,v_normalized,v_matched_id)
  on conflict do nothing;
  select count(*) into v_found from public.pokemon_name_em_all_discoveries where session_id=p_session_id and user_id=v_user_id;
  select count(*) into v_errors from public.pokemon_name_em_all_errors where session_id=p_session_id and user_id=v_user_id;
  return jsonb_build_object('status','INCORRECT','foundCount',v_found,
    'catalogCount',cardinality(v_session.catalog_species_ids),'errorsUnique',v_errors);
end;
$$;
