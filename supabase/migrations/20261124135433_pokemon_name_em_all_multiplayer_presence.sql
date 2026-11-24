create or replace function public.renqd_pokemon_name_em_all_heartbeat(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_old_host uuid;
  v_next_host uuid;
  v_connected integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('ACTIVE','PAUSED') then raise exception 'Sessione non attiva' using errcode='P0002'; end if;
  if not exists(select 1 from public.pokemon_name_em_all_participants where session_id=p_session_id and user_id=v_user_id and is_active and expelled_at is null) then
    raise exception 'Non fai parte della partita' using errcode='42501';
  end if;
  v_old_host:=v_session.host_id;
  update public.pokemon_name_em_all_participants
    set is_connected=false,disconnected_at=coalesce(disconnected_at,now())
    where session_id=p_session_id and is_active and is_connected and last_seen_at<now()-interval '50 seconds';
  update public.pokemon_name_em_all_participants
    set is_connected=true,last_seen_at=now(),disconnected_at=null
    where session_id=p_session_id and user_id=v_user_id;
  if v_old_host is not null and exists(
    select 1 from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_old_host and is_active and not is_connected
  ) then
    if v_old_host=v_session.owner_id then
      update public.pokemon_name_em_all_sessions set host_reclaim_until=coalesce(host_reclaim_until,now()+interval '10 minutes') where id=p_session_id;
    end if;
    select user_id into v_next_host from public.pokemon_name_em_all_participants
     where session_id=p_session_id and is_active and is_connected and expelled_at is null
     order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions set host_id=v_next_host where id=p_session_id;
  end if;
  if v_user_id=v_session.owner_id and v_session.host_reclaim_until is not null and now()<=v_session.host_reclaim_until then
    update public.pokemon_name_em_all_sessions set host_id=v_user_id,host_reclaim_until=null where id=p_session_id;
  elsif v_session.host_id is null then
    select user_id into v_next_host from public.pokemon_name_em_all_participants
     where session_id=p_session_id and is_active and is_connected and expelled_at is null
     order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions set host_id=v_next_host where id=p_session_id;
  end if;
  select count(*) into v_connected from public.pokemon_name_em_all_participants
   where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected=0 and v_session.status='ACTIVE' then
    update public.pokemon_name_em_all_sessions
      set status='PAUSED',remaining_seconds=greatest(0,extract(epoch from (deadline_at-now()))::integer),
          paused_at=now(),deadline_at=null,updated_at=now()
      where id=p_session_id;
  elsif v_connected>0 and v_session.status='PAUSED' then
    update public.pokemon_name_em_all_sessions
      set status='ACTIVE',deadline_at=now()+make_interval(secs=>greatest(0,remaining_seconds)),
          paused_total_seconds=paused_total_seconds+greatest(0,extract(epoch from (now()-paused_at))::integer),
          paused_at=null,updated_at=now()
      where id=p_session_id;
  end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id;
  return jsonb_build_object('status',v_session.status,'hostId',v_session.host_id,
    'deadlineAt',v_session.deadline_at,'remainingSeconds',v_session.remaining_seconds);
end;
$$;

