begin;

-- Speed Renq sessions support durations up to 180 minutes (10,800 seconds).
alter table public.ranking_speed_sessions
  drop constraint if exists ranking_speed_sessions_duration_seconds_check;
alter table public.ranking_speed_sessions
  add constraint ranking_speed_sessions_duration_seconds_check
  check (duration_seconds >= 1 and duration_seconds <= 10800);

-- Reconstructed from the already-applied migration and verified against the
-- live PostgreSQL function definition on 18 November 2026.
CREATE OR REPLACE FUNCTION public.renqd_start_speed_session(p_ranking_id uuid, p_duration_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_speed_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_duration_seconds < 1 or p_duration_seconds > 10800 then
    raise exception 'Durata non valida' using errcode='22023';
  end if;
  perform 1 from public.rankings where id=p_ranking_id and user_id=v_user_id
    and mode='SPEED_RENQ' and deleted_at is null and hidden_at is null for update;
  if not found then raise exception 'Speed Renq non trovato' using errcode='P0002'; end if;

  insert into public.ranking_speed_sessions(ranking_id,user_id,duration_seconds,deadline_at)
  values(p_ranking_id,v_user_id,p_duration_seconds,now()+make_interval(secs=>p_duration_seconds))
  returning * into v_session;
  update public.rankings set status='ACTIVE',started_at=v_session.started_at,updated_at=now()
  where id=p_ranking_id and user_id=v_user_id;
  return jsonb_build_object('id',v_session.id,'started_at',v_session.started_at,'deadline_at',v_session.deadline_at);
end;
$function$;

revoke all on function public.renqd_start_speed_session(uuid,integer) from public, anon;
grant execute on function public.renqd_start_speed_session(uuid,integer) to authenticated;

commit;
