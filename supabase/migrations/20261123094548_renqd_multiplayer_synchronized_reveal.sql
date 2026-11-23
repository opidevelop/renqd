begin;
alter table public.ranking_participants add column if not exists reveal_ready_at timestamptz;
alter table public.ranking_multiplayer_sessions add column if not exists reveal_sync_at timestamptz;

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
  return jsonb_build_object('ok',true,'participantFinished',true,'allFinished',v_all_done);
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
  return jsonb_build_object('ok',true,'participantFinished',true,'allFinished',v_all_done);
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
  return jsonb_build_object('ok',true,'progressStatus',p_progress_status,'allFinished',v_all_done);
 end if;
 return jsonb_build_object('ok',true,'progressStatus',p_progress_status);
end;
$function$;

create or replace function public.renqd_request_multiplayer_reveal(p_ranking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $function$
declare
 v_user_id uuid:=auth.uid();
 v_session public.ranking_multiplayer_sessions%rowtype;
 v_participant public.ranking_participants%rowtype;
 v_finished_count integer;
 v_ready_count integer;
 v_waiting_count integer;
 v_sync_at timestamptz;
 v_final jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then
  raise exception 'Account non autorizzato' using errcode='42501';
 end if;
 select * into v_session from public.ranking_multiplayer_sessions
 where ranking_id=p_ranking_id and status='ACTIVE' for update;
 if not found then raise exception 'Sessione non disponibile per il Reveal' using errcode='P0002'; end if;
 select * into v_participant from public.ranking_participants
 where ranking_id=p_ranking_id and user_id=v_user_id and invitation_status='ACCEPTED'
 for update;
 if not found or v_participant.progress_status<>'FINISHED' then
  raise exception 'Puoi preparare il Reveal solo dopo aver completato il Renq' using errcode='42501';
 end if;
 update public.ranking_participants
 set reveal_ready_at=coalesce(reveal_ready_at,now()),last_activity_at=now()
 where id=v_participant.id;
 select count(*) filter(where progress_status='FINISHED'),
        count(*) filter(where progress_status='FINISHED' and reveal_ready_at is not null),
        count(*) filter(where progress_status not in ('FINISHED','INCOMPLETE'))
 into v_finished_count,v_ready_count,v_waiting_count
 from public.ranking_participants
 where ranking_id=p_ranking_id and invitation_status='ACCEPTED';
 if v_waiting_count>0 then
  return jsonb_build_object('ok',true,'ready',false,'readyCount',v_ready_count,'requiredCount',v_finished_count,'waitingCount',v_waiting_count);
 end if;
 if v_finished_count<1 then raise exception 'Nessun partecipante ha completato il Renq' using errcode='22023'; end if;
 if v_ready_count=v_finished_count then
  v_sync_at:=now()+interval '4 seconds';
  update public.ranking_multiplayer_sessions set reveal_sync_at=v_sync_at,updated_at=now()
  where id=v_session.id;
  v_final:=private.renqd_finalize_multiplayer_session(v_session.id);
  return v_final||jsonb_build_object('ok',true,'ready',true,'readyCount',v_ready_count,'requiredCount',v_finished_count,'revealSyncAt',v_sync_at);
 end if;
 return jsonb_build_object('ok',true,'ready',false,'readyCount',v_ready_count,'requiredCount',v_finished_count,'waitingCount',0);
end;
$function$;

revoke all on function public.renqd_request_multiplayer_reveal(uuid) from public,anon;
grant execute on function public.renqd_request_multiplayer_reveal(uuid) to authenticated;
commit;
