CREATE OR REPLACE FUNCTION public.renqd_save_multiplayer_progress(p_ranking_id uuid, p_result_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_participant public.ranking_participants%rowtype;
  v_item_count integer;
  v_snapshot_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' for update;
  if not found or v_session.session_mode<>'COMPETITIVE' then raise exception 'Sessione competitiva non attiva' using errcode='P0002'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto: attendi la decisione del creatore' using errcode='22023'; end if;
  select * into v_participant from public.ranking_participants
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' and left_at is null
  for update;
  if not found or v_participant.progress_status in ('FINISHED','INCOMPLETE') then raise exception 'Partecipazione già completata o non disponibile' using errcode='42501'; end if;
  if jsonb_typeof(p_result_snapshot) is distinct from 'object' or jsonb_typeof(p_result_snapshot->'items') is distinct from 'array' then
    raise exception 'Progressi non validi' using errcode='22023';
  end if;
  select count(*) into v_item_count from public.ranking_items where ranking_id=p_ranking_id;
  select count(*) into v_snapshot_count from jsonb_array_elements(p_result_snapshot->'items');
  if v_snapshot_count<>v_item_count or exists(
    select 1 from jsonb_array_elements(p_result_snapshot->'items') entry
    where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(entry->>'id')::uuid)
  ) then raise exception 'I progressi non corrispondono agli elementi della classifica' using errcode='22023'; end if;
  insert into public.ranking_session_results(session_id,ranking_id,user_id,result_snapshot,result_status,completed_at,updated_at)
  values(v_session.id,p_ranking_id,v_user_id,p_result_snapshot,'IN_PROGRESS',now(),now())
  on conflict(session_id,user_id) do update
    set result_snapshot=excluded.result_snapshot,result_status='IN_PROGRESS',updated_at=now();
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now()
  where id=v_participant.id;
  return jsonb_build_object('ok',true,'saved',true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_submit_multiplayer_result(p_ranking_id uuid, p_result_snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_ranking public.rankings%rowtype;
  v_participant public.ranking_participants%rowtype;
  v_item_count integer;
  v_snapshot_count integer;
  v_unique_count integer;
  v_all_done boolean;
  v_final jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id for update;
  if not found or v_session.session_mode<>'COMPETITIVE' or v_session.status<>'ACTIVE' then raise exception 'Sessione competitiva non attiva' using errcode='P0002'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto: attendi la decisione del creatore' using errcode='22023'; end if;
  select * into v_participant from public.ranking_participants
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' and left_at is null for update;
  if not found or v_participant.progress_status='INCOMPLETE' then raise exception 'Non fai parte della sessione attiva' using errcode='42501'; end if;
  if v_participant.progress_status='FINISHED' then return jsonb_build_object('ok',true,'alreadyFinished',true); end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;
  if jsonb_typeof(p_result_snapshot) is distinct from 'object' or jsonb_typeof(p_result_snapshot->'items') is distinct from 'array' then
    raise exception 'Snapshot del risultato non valido' using errcode='22023';
  end if;
  select count(*) into v_item_count from public.ranking_items where ranking_id=p_ranking_id;
  select count(*) into v_snapshot_count from jsonb_array_elements(p_result_snapshot->'items');
  select count(distinct (entry->>'id')) into v_unique_count from jsonb_array_elements(p_result_snapshot->'items') entry;
  if v_snapshot_count<>v_item_count or v_unique_count<>v_item_count
    or exists(select 1 from jsonb_array_elements(p_result_snapshot->'items') entry
      where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(entry->>'id')::uuid)) then
    raise exception 'Il risultato deve contenere tutti gli elementi una sola volta' using errcode='22023';
  end if;
  if v_ranking.mode='GRADE' then
    if exists(select 1 from jsonb_array_elements(p_result_snapshot->'items') entry
      where nullif(entry->>'score','') is not null and (entry->>'score')::numeric not between 0 and 10) then
      raise exception 'Voto Grade non valido' using errcode='22023';
    end if;
  elsif v_ranking.mode='BATTLE_RENQ' then
    if exists(select 1 from jsonb_array_elements(p_result_snapshot->'items') entry where coalesce((entry->>'wins')::integer,-1)<0) then
      raise exception 'Vittorie Battle non valide' using errcode='22023';
    end if;
  else
    if exists(select 1 from jsonb_array_elements(p_result_snapshot->'items') entry where coalesce((entry->>'rank_position')::integer,0)<1) then
      raise exception 'Posizioni individuali non valide' using errcode='22023';
    end if;
  end if;
  insert into public.ranking_session_results(session_id,ranking_id,user_id,result_snapshot,result_status,completed_at,updated_at)
  values(v_session.id,p_ranking_id,v_user_id,p_result_snapshot,'FINISHED',now(),now())
  on conflict(session_id,user_id) do update
    set result_snapshot=excluded.result_snapshot,result_status='FINISHED',completed_at=now(),updated_at=now();
  update public.ranking_participants set progress_status='FINISHED',completed_at=now(),last_activity_at=now()
  where id=v_participant.id;
  select not exists(select 1 from public.ranking_participants
    where ranking_id=p_ranking_id and invitation_status='ACCEPTED'
      and progress_status not in ('FINISHED','INCOMPLETE')) into v_all_done;
  if v_all_done then
    v_final:=private.renqd_finalize_multiplayer_session(v_session.id);
    return v_final || jsonb_build_object('participantFinished',true);
  end if;
  return jsonb_build_object('ok',true,'participantFinished',true,'allFinished',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_mark_multiplayer_finished(p_ranking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_participant public.ranking_participants%rowtype;v_all_done boolean;v_final jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' for update;
  if not found or v_session.session_mode<>'COLLABORATIVE' then raise exception 'Sessione collaborativa non attiva' using errcode='P0002'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto: attendi la decisione del creatore' using errcode='22023'; end if;
  select * into v_participant from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' and left_at is null for update;
  if not found then raise exception 'Non fai parte della sessione' using errcode='42501'; end if;
  if v_participant.progress_status='FINISHED' then return jsonb_build_object('ok',true,'alreadyFinished',true); end if;
  update public.ranking_participants set progress_status='FINISHED',completed_at=now(),last_activity_at=now() where id=v_participant.id;
  select not exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status not in ('FINISHED','INCOMPLETE')) into v_all_done;
  if v_all_done then v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final||jsonb_build_object('participantFinished',true);end if;
  return jsonb_build_object('ok',true,'participantFinished',true,'allFinished',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_set_multiplayer_progress(p_ranking_id uuid, p_progress_status text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_participant public.ranking_participants%rowtype;v_all_done boolean;v_final jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 if p_progress_status not in ('IN_PROGRESS','INCOMPLETE') then raise exception 'Stato partecipazione non valido' using errcode='22023'; end if;
 select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' for update;
 if not found then raise exception 'Sessione non attiva' using errcode='P0002'; end if;
 if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto: attendi la decisione del creatore' using errcode='22023'; end if;
 select * into v_participant from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED' for update;
 if not found then raise exception 'Non fai parte della sessione' using errcode='42501'; end if;
 if v_participant.progress_status='FINISHED' then raise exception 'Partecipazione già completata' using errcode='22023'; end if;
 if v_participant.progress_status='INCOMPLETE' and p_progress_status='IN_PROGRESS' then raise exception 'Partecipazione già segnata come incompleta' using errcode='22023'; end if;
 update public.ranking_participants set progress_status=p_progress_status,left_at=case when p_progress_status='INCOMPLETE' then coalesce(left_at,now()) else left_at end,last_activity_at=now() where id=v_participant.id;
 if p_progress_status='INCOMPLETE' then
  select not exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status not in ('FINISHED','INCOMPLETE')) into v_all_done;
  if v_all_done then v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final||jsonb_build_object('participantIncomplete',true);end if;
 end if;
 return jsonb_build_object('ok',true,'progressStatus',p_progress_status);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_order(p_ranking_id uuid, p_ordered_ids uuid[], p_tie_map jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;
  v_count integer;v_position integer:=0;v_previous_group text:=null;v_group text;v_effective_group text;v_seen text[]:='{}';v_id uuid;v_ord integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then
    raise exception 'Partecipazione non più modificabile' using errcode='42501';
  end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)='SPEED_RENQ'
    and nullif(v_session.shared_state->'speed'->>'deadlineAt','') is not null
    and now()>=(v_session.shared_state->'speed'->>'deadlineAt')::timestamptz then raise exception 'Il timer Speed è terminato' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;
  if v_ranking.mode not in ('RENQ','SPEED_RENQ') then raise exception 'Ordine non modificabile per questa tipologia' using errcode='22023'; end if;
  select count(*) into v_count from public.ranking_items where ranking_id=p_ranking_id;
  update public.ranking_items set sort_order=sort_order+v_count+1 where ranking_id=p_ranking_id;
  if coalesce(array_length(p_ordered_ids,1),0)<>v_count or (select count(distinct x) from unnest(p_ordered_ids) x)<>v_count
    or exists(select 1 from unnest(p_ordered_ids) x where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=x)) then
    raise exception 'Ordine degli elementi non valido' using errcode='22023';
  end if;
  for v_id,v_ord in select id,ord from unnest(p_ordered_ids) with ordinality as x(id,ord) loop
    v_group:=nullif(p_tie_map->>v_id::text,'');
    if v_group is not null and v_group !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Gruppo ex aequo non valido' using errcode='22023'; end if;
    v_effective_group:=coalesce(v_group,'single:'||v_id::text);
    if v_effective_group is distinct from v_previous_group then
      v_position:=v_position+1;
      if v_group is not null then
        if v_group=any(v_seen) then raise exception 'I pari merito devono essere consecutivi' using errcode='22023'; end if;
        v_seen:=array_append(v_seen,v_group);
      end if;
    end if;
    update public.ranking_items set rank_position=v_position,tie_group_id=v_group::uuid,tie_order=v_ord,sort_order=v_ord where id=v_id and ranking_id=p_ranking_id;
    v_previous_group:=v_effective_group;
  end loop;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now()
  where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  return jsonb_build_object('ok',true,'updated',v_count);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_update_shared_grade(p_ranking_id uuid, p_scores jsonb, p_tie_order jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_total integer;v_rated integer;v_avg numeric(3,1);
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  if (select mode from public.rankings where id=p_ranking_id)<>'GRADE' then raise exception 'Questa classifica non è Grade' using errcode='22023'; end if;
  select count(*) into v_total from public.ranking_items where ranking_id=p_ranking_id;
  if jsonb_typeof(p_scores) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_scores))>v_total
    or exists(select 1 from jsonb_object_keys(p_scores) k where not exists(select 1 from public.ranking_items ri where ri.id::text=k and ri.ranking_id=p_ranking_id))
    or exists(select 1 from jsonb_each_text(p_scores) s where s.value !~ '^(10([.]0)?|[0-9]([.]0)?|[0-9][.][0-9])$' or s.value::numeric<0 or s.value::numeric>10) then
    raise exception 'Voti Grade non validi' using errcode='22023';
  end if;
  update public.ranking_items set score=null,rank_position=null,tie_group_id=null,tie_order=sort_order where ranking_id=p_ranking_id;
  with rated as (
    select ri.id,(p_scores->>ri.id::text)::numeric(3,1) score,coalesce((p_tie_order->>ri.id::text)::integer,ri.sort_order) tie_order
    from public.ranking_items ri where ri.ranking_id=p_ranking_id and p_scores?ri.id::text
  ), ordered as (select *,dense_rank() over(order by score desc) rank_position,count(*) over(partition by score) tie_count from rated)
  update public.ranking_items ri set score=o.score,rank_position=o.rank_position,
    tie_group_id=case when o.tie_count>1 then md5(p_ranking_id::text||':'||o.score::text)::uuid else null end,tie_order=o.tie_order
  from ordered o where ri.id=o.id;
  select count(*),round(avg((p_scores->>k)::numeric),1) into v_rated,v_avg from jsonb_object_keys(p_scores) k;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED';
  return jsonb_build_object('ok',true,'average',v_avg,'ratedCount',v_rated,'unratedCount',v_total-v_rated);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_battle_start(p_ranking_id uuid, p_pairs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.shared_state ? 'battle' then return v_session.shared_state->'battle'; end if;
  if jsonb_typeof(p_pairs) is distinct from 'array' or jsonb_array_length(p_pairs)<1 then raise exception 'Confronti Battle non validi' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_pairs) pair
    where not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(pair->>'a')::uuid)
       or not exists(select 1 from public.ranking_items ri where ri.ranking_id=p_ranking_id and ri.id=(pair->>'b')::uuid)
       or (pair->>'a')=(pair->>'b')) then raise exception 'Confronti Battle non validi' using errcode='22023'; end if;
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{battle}',jsonb_build_object('pairs',p_pairs,'cursor',0,'wins','{}'::jsonb,'tiePairs','[]'::jsonb,'status','ACTIVE'),true),updated_at=now()
  where id=v_session.id;
  return jsonb_build_object('pairs',p_pairs,'cursor',0,'wins','{}'::jsonb,'tiePairs','[]'::jsonb,'status','ACTIVE');
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_battle_choice(p_ranking_id uuid, p_winner_item_id uuid DEFAULT NULL::uuid, p_is_tie boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;
  v_battle jsonb;v_pairs jsonb;v_pair jsonb;v_cursor integer;v_total integer;v_wins jsonb;v_ties jsonb;
  v_a text;v_b text;v_winner text;v_id text;v_parent jsonb:='{}'::jsonb;v_root_a text;v_root_b text;v_root text;
  v_ids text[];v_roots text[];v_group record;v_position integer:=0;v_group_id uuid;v_rank_positions jsonb:='{}'::jsonb;v_tie_groups jsonb:='{}'::jsonb;v_allow_ties boolean;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  if v_session.deadline_at is not null and now()>=v_session.deadline_at then raise exception 'Il tempo è scaduto' using errcode='22023'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;v_allow_ties:=v_ranking.allow_ties;
  v_battle:=v_session.shared_state->'battle';
  if v_battle is null or v_battle->>'status'<>'ACTIVE' then raise exception 'Battle condivisa non attiva' using errcode='P0002'; end if;
  v_pairs:=v_battle->'pairs';v_cursor:=coalesce((v_battle->>'cursor')::integer,0);v_total:=jsonb_array_length(v_pairs);
  if v_cursor>=v_total then return v_battle||jsonb_build_object('completed',true); end if;
  v_pair:=v_pairs->v_cursor;v_a:=v_pair->>'a';v_b:=v_pair->>'b';v_wins:=coalesce(v_battle->'wins','{}'::jsonb);v_ties:=coalesce(v_battle->'tiePairs','[]'::jsonb);
  if p_is_tie then
    if not v_allow_ties then raise exception 'I pari merito non sono consentiti' using errcode='22023'; end if;
    v_ties:=v_ties||jsonb_build_array(jsonb_build_object('a',v_a,'b',v_b));
  else
    if p_winner_item_id is null then raise exception 'Seleziona un vincitore' using errcode='22023'; end if;
    v_winner:=p_winner_item_id::text;
    if v_winner not in (v_a,v_b) then raise exception 'Scelta non valida per questo confronto' using errcode='22023'; end if;
    v_wins:=jsonb_set(v_wins,array[v_winner],to_jsonb(coalesce((v_wins->>v_winner)::integer,0)+1),true);
  end if;
  v_cursor:=v_cursor+1;
  v_battle:=jsonb_build_object('pairs',v_pairs,'cursor',v_cursor,'wins',v_wins,'tiePairs',v_ties,'status',case when v_cursor>=v_total then 'COMPLETED' else 'ACTIVE' end);
  if v_cursor>=v_total then
    select array_agg(id::text order by sort_order) into v_ids from public.ranking_items where ranking_id=p_ranking_id;
    foreach v_id in array v_ids loop v_parent:=v_parent||jsonb_build_object(v_id,v_id); end loop;
    if v_allow_ties then
      for v_id in select id::text from public.ranking_items where ranking_id=p_ranking_id loop
        v_root:=coalesce(v_wins->>v_id,'0');
        for v_root_a in select ri.id::text from public.ranking_items ri where ri.ranking_id=p_ranking_id and coalesce((v_wins->>ri.id::text)::integer,0)=v_root::integer loop
          v_parent:=jsonb_set(v_parent,array[v_root_a],to_jsonb('wins:'||v_root),true);
        end loop;
      end loop;
      for v_pair in select value from jsonb_array_elements(v_ties) loop
        v_a:=v_pair->>'a';v_b:=v_pair->>'b';v_root_a:=v_parent->>v_a;v_root_b:=v_parent->>v_b;
        if v_root_a is distinct from v_root_b then
          for v_id in select key from jsonb_each_text(v_parent) where value=v_root_b loop v_parent:=jsonb_set(v_parent,array[v_id],to_jsonb(v_root_a),true); end loop;
        end if;
      end loop;
    end if;
    with groups as (
      select coalesce(v_parent->>ri.id::text,ri.id::text) root,array_agg(ri.id::text order by ri.sort_order) ids,
        max(coalesce((v_wins->>ri.id::text)::integer,0)) wins
      from public.ranking_items ri where ri.ranking_id=p_ranking_id group by coalesce(v_parent->>ri.id::text,ri.id::text)
    ) select array_agg(root order by wins desc,root) into v_roots from groups;
    foreach v_root in array v_roots loop
      v_position:=v_position+1;
      select * into v_group from (
        select coalesce(v_parent->>ri.id::text,ri.id::text) root,array_agg(ri.id::text order by ri.sort_order) ids
        from public.ranking_items ri where ri.ranking_id=p_ranking_id group by coalesce(v_parent->>ri.id::text,ri.id::text)
      ) g where g.root=v_root;
      v_group_id:=case when array_length(v_group.ids,1)>1 then gen_random_uuid() else null end;
      foreach v_id in array v_group.ids loop
        v_rank_positions:=v_rank_positions||jsonb_build_object(v_id,v_position);
        if v_group_id is not null then v_tie_groups:=v_tie_groups||jsonb_build_object(v_id,v_group_id); end if;
        update public.ranking_items set rank_position=v_position,tie_group_id=v_group_id,tie_order=array_position(v_group.ids,v_id) where id=v_id::uuid and ranking_id=p_ranking_id;
      end loop;
    end loop;
    v_battle:=v_battle||jsonb_build_object('rankPositions',v_rank_positions,'tieGroups',v_tie_groups);
  end if;
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{battle}',v_battle,true),updated_at=now() where id=v_session.id;
  update public.ranking_participants set progress_status='IN_PROGRESS',last_activity_at=now() where ranking_id=p_ranking_id and user_id=v_user_id;
  return v_battle||jsonb_build_object('completed',v_cursor>=v_total);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_speed_start(p_ranking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;v_duration integer;v_deadline timestamptz;v_speed jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and status='ACTIVE' and session_mode='COLLABORATIVE' for update;
  if not found or not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Sessione collaborativa non disponibile' using errcode='42501'; end if;
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status in ('FINISHED','INCOMPLETE'))) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id;
  if v_ranking.mode<>'SPEED_RENQ' then raise exception 'Questa classifica non è Speed Renq' using errcode='22023'; end if;
  v_speed:=v_session.shared_state->'speed';if v_speed is not null then return v_speed; end if;
  v_duration:=coalesce((v_ranking.settings->>'durationSeconds')::integer,60);
  if v_duration<1 or v_duration>10800 then raise exception 'Durata Speed non valida' using errcode='22023'; end if;
  v_deadline:=least(now()+make_interval(secs=>v_duration),v_session.deadline_at);
  update public.ranking_multiplayer_sessions set shared_state=jsonb_set(shared_state,'{speed}',jsonb_build_object('startedAt',now(),'deadlineAt',v_deadline,'durationSeconds',v_duration),true),updated_at=now() where id=v_session.id;
  return jsonb_build_object('startedAt',now(),'deadlineAt',v_deadline,'durationSeconds',v_duration);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_decide(p_ranking_id uuid, p_action text, p_extend_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_final jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and creator_id=v_user_id and status in ('ACTIVE','AWAITING_DECISION') for update;
 if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
 if v_session.deadline_at is null or now()<v_session.deadline_at then raise exception 'La decisione è disponibile solo alla scadenza del timer' using errcode='22023'; end if;
 if p_action='EXTEND' then
  if p_extend_minutes is null or p_extend_minutes not between 1 and 1440 then raise exception 'La proroga deve essere compresa tra 1 e 1440 minuti' using errcode='22023'; end if;
  update public.ranking_multiplayer_sessions set status='ACTIVE',deadline_at=now()+make_interval(mins=>p_extend_minutes),extension_count=extension_count+1,updated_at=now() where id=v_session.id;
  return jsonb_build_object('status','ACTIVE','deadlineAt',now()+make_interval(mins=>p_extend_minutes));
 elsif p_action='REVEAL' then v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final;
 else raise exception 'Azione non valida' using errcode='22023'; end if;
end;
$function$;

REVOKE ALL ON FUNCTION public.renqd_save_multiplayer_progress(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_save_multiplayer_progress(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_submit_multiplayer_result(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_submit_multiplayer_result(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_mark_multiplayer_finished(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_mark_multiplayer_finished(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_set_multiplayer_progress(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_set_multiplayer_progress(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_update_shared_order(uuid,uuid[],jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_update_shared_grade(uuid,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_battle_start(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_battle_start(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_battle_choice(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_battle_choice(uuid,uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_speed_start(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_speed_start(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) TO authenticated;
