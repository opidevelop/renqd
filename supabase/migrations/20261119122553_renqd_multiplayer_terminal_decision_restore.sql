CREATE OR REPLACE FUNCTION public.renqd_set_multiplayer_progress(p_ranking_id uuid, p_progress_status text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_participant public.ranking_participants%rowtype;v_all_done boolean;v_completed_count integer;v_final jsonb;
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
  if v_all_done then
   select count(*) into v_completed_count from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
   if v_completed_count>0 then v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final||jsonb_build_object('participantIncomplete',true);end if;
   update public.ranking_participants set invitation_status='REVOKED' where ranking_id=p_ranking_id and invitation_status='PENDING';
   update public.ranking_invite_links set revoked_at=coalesce(revoked_at,now()) where session_id=v_session.id;
   update public.ranking_multiplayer_sessions set status='CANCELLED',closed_at=now(),updated_at=now() where id=v_session.id;
   update public.rankings set status='CANCELLED',updated_at=now() where id=p_ranking_id;
   return jsonb_build_object('ok',true,'status','CANCELLED','noCompletedParticipants',true);
  end if;
 end if;
 return jsonb_build_object('ok',true,'progressStatus',p_progress_status);
end;
$function$;

CREATE OR REPLACE FUNCTION public.renqd_multiplayer_decide(p_ranking_id uuid, p_action text, p_extend_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_completed_count integer;v_final jsonb;
begin
 if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
 select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and creator_id=v_user_id and status in ('ACTIVE','AWAITING_DECISION') for update;
 if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
 if p_action='CLOSE_EARLY' then
  select count(*) into v_completed_count from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
  if v_completed_count=0 then
   update public.ranking_participants set invitation_status='REVOKED' where ranking_id=p_ranking_id and invitation_status='PENDING';
   update public.ranking_invite_links set revoked_at=coalesce(revoked_at,now()) where session_id=v_session.id;
   update public.ranking_multiplayer_sessions set status='CANCELLED',closed_at=now(),updated_at=now() where id=v_session.id;
   update public.rankings set status='CANCELLED',updated_at=now() where id=p_ranking_id;
   return jsonb_build_object('ok',true,'status','CANCELLED','noCompletedParticipants',true,'closedEarly',true);
  end if;
  v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final||jsonb_build_object('closedEarly',true);
 end if;
 if v_session.deadline_at is null or now()<v_session.deadline_at then raise exception 'Reveal e proroga sono disponibili solo alla scadenza del timer' using errcode='22023'; end if;
 if p_action='EXTEND' then
  if p_extend_minutes is null or p_extend_minutes not between 1 and 1440 then raise exception 'La proroga deve essere compresa tra 1 e 1440 minuti' using errcode='22023'; end if;
  update public.ranking_multiplayer_sessions set status='ACTIVE',deadline_at=now()+make_interval(mins=>p_extend_minutes),extension_count=extension_count+1,updated_at=now() where id=v_session.id;
  return jsonb_build_object('status','ACTIVE','deadlineAt',now()+make_interval(mins=>p_extend_minutes));
 elsif p_action='REVEAL' then
  select count(*) into v_completed_count from public.ranking_participants where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
  if v_completed_count=0 then
   update public.ranking_participants set invitation_status='REVOKED' where ranking_id=p_ranking_id and invitation_status='PENDING';
   update public.ranking_invite_links set revoked_at=coalesce(revoked_at,now()) where session_id=v_session.id;
   update public.ranking_multiplayer_sessions set status='CANCELLED',closed_at=now(),updated_at=now() where id=v_session.id;
   update public.rankings set status='CANCELLED',updated_at=now() where id=p_ranking_id;
   return jsonb_build_object('ok',true,'status','CANCELLED','noCompletedParticipants',true);
  end if;
  v_final:=private.renqd_finalize_multiplayer_session(v_session.id);return v_final;
 else raise exception 'Azione non valida' using errcode='22023';
 end if;
end;
$function$;

REVOKE ALL ON FUNCTION public.renqd_set_multiplayer_progress(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_set_multiplayer_progress(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) TO authenticated;
