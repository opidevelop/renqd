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
  v_connected_before integer;
  v_connected_after integer;
  v_disconnect_at timestamptz;
  v_pause_at timestamptz;
  v_remaining integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.pokemon_name_em_all_sessions
    where id=p_session_id for update;
  if not found or v_session.status not in ('ACTIVE','PAUSED') then
    raise exception 'Sessione non attiva' using errcode='P0002';
  end if;
  if not exists(select 1 from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_user_id and is_active and expelled_at is null) then
    raise exception 'Non fai parte della partita' using errcode='42501';
  end if;

  v_old_host:=v_session.host_id;
  update public.pokemon_name_em_all_participants
    set is_connected=false,disconnected_at=coalesce(disconnected_at,last_seen_at+interval '50 seconds')
    where session_id=p_session_id and is_active and is_connected
      and last_seen_at<now()-interval '50 seconds';

  if v_old_host is not null and exists(
    select 1 from public.pokemon_name_em_all_participants
    where session_id=p_session_id and user_id=v_old_host and is_active and not is_connected
  ) then
    select least(now(),coalesce(last_seen_at+interval '50 seconds',now())) into v_disconnect_at
      from public.pokemon_name_em_all_participants where session_id=p_session_id and user_id=v_old_host;
    if v_old_host=v_session.owner_id then
      update public.pokemon_name_em_all_sessions
        set host_reclaim_until=coalesce(host_reclaim_until,v_disconnect_at+interval '10 minutes')
        where id=p_session_id;
    end if;
    select user_id into v_next_host from public.pokemon_name_em_all_participants
      where session_id=p_session_id and is_active and is_connected and expelled_at is null
      order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions set host_id=v_next_host where id=p_session_id;
  end if;

  select count(*) into v_connected_before from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected_before=0 and v_session.status='ACTIVE' then
    select least(now(),coalesce(max(last_seen_at)+interval '50 seconds',now()-interval '50 seconds'))
      into v_pause_at
      from public.pokemon_name_em_all_participants
      where session_id=p_session_id and is_active and expelled_at is null;
    v_remaining:=greatest(0,extract(epoch from (coalesce(v_session.deadline_at,now())-v_pause_at))::integer);
    update public.pokemon_name_em_all_sessions
      set status='PAUSED',remaining_seconds=v_remaining,paused_at=v_pause_at,
          deadline_at=null,updated_at=now()
      where id=p_session_id;
  else
    v_pause_at:=v_session.paused_at;
    v_remaining:=coalesce(v_session.remaining_seconds,0);
  end if;

  update public.pokemon_name_em_all_participants
    set is_connected=true,last_seen_at=now(),disconnected_at=null
    where session_id=p_session_id and user_id=v_user_id;

  if v_user_id=v_session.owner_id and v_session.host_reclaim_until is not null and now()<=v_session.host_reclaim_until then
    update public.pokemon_name_em_all_sessions set host_id=v_user_id,host_reclaim_until=null where id=p_session_id;
  elsif not exists(select 1 from public.pokemon_name_em_all_sessions where id=p_session_id and host_id is not null) then
    select user_id into v_next_host from public.pokemon_name_em_all_participants
      where session_id=p_session_id and is_active and is_connected and expelled_at is null
      order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions set host_id=v_next_host where id=p_session_id;
  end if;

  select count(*) into v_connected_after from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected_after>0 and (v_session.status='PAUSED' or v_connected_before=0) then
    update public.pokemon_name_em_all_sessions
      set status='ACTIVE',deadline_at=now()+make_interval(secs=>greatest(0,v_remaining)),
          paused_total_seconds=paused_total_seconds+greatest(0,extract(epoch from (now()-coalesce(v_pause_at,v_session.paused_at)))::integer),
          paused_at=null,updated_at=now()
      where id=p_session_id;
  end if;

  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id;
  return jsonb_build_object('status',v_session.status,'hostId',v_session.host_id,
    'deadlineAt',v_session.deadline_at,'remainingSeconds',v_session.remaining_seconds);
end;
$$;

revoke all on function public.renqd_pokemon_name_em_all_heartbeat(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_heartbeat(uuid) to authenticated;

do $$
declare v_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array array[
      'pokemon_name_em_all_sessions',
      'pokemon_name_em_all_participants',
      'pokemon_name_em_all_discoveries'
    ] loop
      if not exists(select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$$;
