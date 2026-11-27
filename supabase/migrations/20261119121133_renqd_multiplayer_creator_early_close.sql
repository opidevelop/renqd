CREATE OR REPLACE FUNCTION public.renqd_multiplayer_decide(p_ranking_id uuid, p_action text, p_extend_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_completed_count integer;
  v_final jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status in ('ACTIVE','AWAITING_DECISION')
  for update;
  if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;

  if p_action='CLOSE_EARLY' then
    select count(*) into v_completed_count
    from public.ranking_participants
    where ranking_id=p_ranking_id and invitation_status='ACCEPTED' and progress_status='FINISHED';
    if v_completed_count<1 then
      raise exception 'Almeno un partecipante deve completare la classifica prima della chiusura anticipata' using errcode='22023';
    end if;
    v_final:=private.renqd_finalize_multiplayer_session(v_session.id);
    return v_final||jsonb_build_object('closedEarly',true);
  end if;

  if v_session.deadline_at is null or now()<v_session.deadline_at then
    raise exception 'Reveal e proroga sono disponibili solo alla scadenza del timer' using errcode='22023';
  end if;
  if p_action='EXTEND' then
    if p_extend_minutes is null or p_extend_minutes not between 1 and 1440 then
      raise exception 'La proroga deve essere compresa tra 1 e 1440 minuti' using errcode='22023';
    end if;
    update public.ranking_multiplayer_sessions
    set status='ACTIVE',deadline_at=now()+make_interval(mins=>p_extend_minutes),
      extension_count=extension_count+1,updated_at=now()
    where id=v_session.id;
    return jsonb_build_object('status','ACTIVE','deadlineAt',now()+make_interval(mins=>p_extend_minutes));
  elsif p_action='REVEAL' then
    v_final:=private.renqd_finalize_multiplayer_session(v_session.id);
    return v_final;
  else
    raise exception 'Azione non valida' using errcode='22023';
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.renqd_multiplayer_decide(uuid,text,integer) TO authenticated;
