create or replace function private.join_pokemon_name_em_all_session(p_session_id uuid,p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_existing public.pokemon_name_em_all_participants%rowtype;
  v_ranking_id uuid;
  v_order integer[];
  v_count integer;
begin
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then
    raise exception 'Sessione non disponibile' using errcode='P0002';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id and status='APPROVED') then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;

  select * into v_existing from public.pokemon_name_em_all_participants
   where session_id=p_session_id and user_id=p_user_id for update;
  if found then
    if v_existing.expelled_at is not null then raise exception 'Non puoi rientrare in questa partita' using errcode='42501'; end if;
    update public.pokemon_name_em_all_participants
      set is_active=true,is_connected=true,left_at=null,disconnected_at=null,last_seen_at=now()
      where id=v_existing.id;
    if v_session.host_id is null
      and (p_user_id<>v_session.owner_id or v_session.host_reclaim_until is null or now()<=v_session.host_reclaim_until) then
      update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
    end if;
    return jsonb_build_object('sessionId',p_session_id,'rankingId',v_existing.ranking_id,'rejoined',true,'status',v_session.status);
  end if;

  select count(*) into v_count from public.pokemon_name_em_all_participants
   where session_id=p_session_id;
  if v_count>=8 then raise exception 'La partita ha già raggiunto il limite di 8 partecipanti' using errcode='22023'; end if;

  v_ranking_id:=private.create_pokemon_name_em_all_participant_ranking(p_user_id,p_session_id,v_session.game_mode);
  if v_session.game_mode='COLLABORATIVE' or coalesce(v_session.config->>'sortOrder','POKEDEX')<>'RANDOM' then
    v_order:=v_session.catalog_species_ids;
  else
    select coalesce(array_agg(x order by random()),'{}'::integer[]) into v_order
    from unnest(v_session.catalog_species_ids) x;
  end if;
  insert into public.pokemon_name_em_all_participants(
    session_id,ranking_id,user_id,participant_role,is_ready,is_active,is_connected,
    joined_at,last_seen_at,catalog_order
  ) values(
    p_session_id,v_ranking_id,p_user_id,'PARTICIPANT',false,true,true,now(),now(),v_order
  );
  if v_session.host_id is null
    and (p_user_id<>v_session.owner_id or v_session.host_reclaim_until is null or now()<=v_session.host_reclaim_until) then
    update public.pokemon_name_em_all_sessions set host_id=p_user_id where id=p_session_id;
  end if;
  return jsonb_build_object('sessionId',p_session_id,'rankingId',v_ranking_id,'rejoined',false,'status',v_session.status);
end;
$$;

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
  v_reclaim_until timestamptz;
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

  update public.pokemon_name_em_all_participants
    set is_active=false,is_ready=false
    where session_id=p_session_id and is_active and not is_connected and expelled_at is null
      and left_at is null and disconnected_at<now()-interval '10 minutes' and user_id<>v_user_id;

  select count(*) into v_connected_before from public.pokemon_name_em_all_participants
    where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected_before=0 and v_session.status='ACTIVE' then
    select least(now(),greatest(coalesce(max(last_seen_at)+interval '50 seconds',now()-interval '50 seconds'),coalesce(v_session.started_at,now())))
      into v_pause_at
      from public.pokemon_name_em_all_participants
      where session_id=p_session_id and expelled_at is null and left_at is null;
    v_remaining:=greatest(0,extract(epoch from (coalesce(v_session.deadline_at,now())-greatest(v_pause_at,coalesce(v_session.started_at,v_pause_at))))::integer);
    update public.pokemon_name_em_all_sessions
      set status='PAUSED',remaining_seconds=v_remaining,paused_at=v_pause_at,
          deadline_at=null,updated_at=now()
      where id=p_session_id;
  else
    v_pause_at:=v_session.paused_at;
    v_remaining:=coalesce(v_session.remaining_seconds,0);
  end if;

  update public.pokemon_name_em_all_participants
    set is_active=true,is_connected=true,last_seen_at=now(),disconnected_at=null
    where session_id=p_session_id and user_id=v_user_id;

  select host_reclaim_until into v_reclaim_until from public.pokemon_name_em_all_sessions where id=p_session_id;
  if v_user_id=v_session.owner_id and v_reclaim_until is not null and now()<=v_reclaim_until then
    update public.pokemon_name_em_all_sessions set host_id=v_user_id,host_reclaim_until=null where id=p_session_id;
  elsif not exists(select 1 from public.pokemon_name_em_all_sessions where id=p_session_id and host_id is not null) then
    select user_id into v_next_host from public.pokemon_name_em_all_participants
      where session_id=p_session_id and is_active and is_connected and expelled_at is null
        and (user_id<>v_session.owner_id or v_reclaim_until is null or now()<=v_reclaim_until)
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

create or replace function public.renqd_pokemon_name_em_all_rejoin_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  return private.join_pokemon_name_em_all_session(p_session_id,v_user_id);
end;
$$;
revoke all on function public.renqd_pokemon_name_em_all_rejoin_session(uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_rejoin_session(uuid) to authenticated;
