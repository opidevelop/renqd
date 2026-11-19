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
  if exists(select 1 from public.ranking_participants where ranking_id=p_ranking_id and user_id=v_user_id and (left_at is not null or progress_status='INCOMPLETE')) then raise exception 'Partecipazione non più modificabile' using errcode='42501'; end if;
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
revoke all on function public.renqd_multiplayer_speed_start(uuid) from public,anon;
grant execute on function public.renqd_multiplayer_speed_start(uuid) to authenticated;
