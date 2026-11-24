create or replace function public.renqd_pokemon_name_em_all_leave(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_next_host uuid;
  v_connected integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status not in ('LOBBY','ACTIVE','PAUSED') then raise exception 'Sessione non disponibile' using errcode='P0002'; end if;
  update public.pokemon_name_em_all_participants
   set is_active=false,is_connected=false,is_ready=false,left_at=now(),disconnected_at=now()
   where session_id=p_session_id and user_id=v_user_id and expelled_at is null;
  if not found then raise exception 'Non fai parte della partita' using errcode='42501'; end if;
  if v_session.host_id=v_user_id then
    select user_id into v_next_host from public.pokemon_name_em_all_participants
     where session_id=p_session_id and is_active and is_connected and expelled_at is null and user_id<>v_user_id
     order by joined_at asc limit 1;
    update public.pokemon_name_em_all_sessions set host_id=v_next_host,host_reclaim_until=null where id=p_session_id;
  end if;
  select count(*) into v_connected from public.pokemon_name_em_all_participants
   where session_id=p_session_id and is_active and is_connected and expelled_at is null;
  if v_connected=0 and v_session.status='ACTIVE' then
    update public.pokemon_name_em_all_sessions
      set status='PAUSED',remaining_seconds=greatest(0,extract(epoch from (deadline_at-now()))::integer),
          paused_at=now(),deadline_at=null,updated_at=now()
      where id=p_session_id;
  end if;
  return jsonb_build_object('left',true,'sessionId',p_session_id);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_expel(p_session_id uuid,p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_actor uuid:=auth.uid();v_role text;
begin
  if v_actor is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select role into v_role from public.profiles where id=v_actor and status='APPROVED';
  if coalesce(v_role,'')<>'OWNER' then raise exception 'Solo il proprietario della piattaforma può espellere un partecipante' using errcode='42501'; end if;
  update public.pokemon_name_em_all_participants
   set is_active=false,is_connected=false,is_ready=false,left_at=now(),disconnected_at=now(),expelled_at=now(),expelled_by=v_actor
   where session_id=p_session_id and user_id=p_user_id and expelled_at is null;
  if not found then raise exception 'Partecipante non trovato' using errcode='P0002'; end if;
  if not exists(select 1 from public.pokemon_name_em_all_sessions where id=p_session_id and status in ('LOBBY','ACTIVE','PAUSED')) then
    raise exception 'Sessione non disponibile' using errcode='22023';
  end if;
  update public.pokemon_name_em_all_sessions s
    set host_id=(select p.user_id from public.pokemon_name_em_all_participants p
      where p.session_id=p_session_id and p.is_active and p.is_connected and p.expelled_at is null
      order by p.joined_at asc limit 1)
    where s.id=p_session_id and s.host_id=p_user_id;
  return jsonb_build_object('expelled',true,'userId',p_user_id);
end;
$$;

revoke all on function private.create_pokemon_name_em_all_participant_ranking(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.join_pokemon_name_em_all_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.renqd_pokemon_name_em_all_create_multiplayer(jsonb,text) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_invite_users(uuid,text[]) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_create_invite_link(uuid,text,timestamptz) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_join_by_token(text) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_respond_invite(uuid,boolean) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_set_ready(uuid,boolean) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_start_multiplayer(uuid) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_heartbeat(uuid) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_leave(uuid) from public,anon;
revoke all on function public.renqd_pokemon_name_em_all_expel(uuid,uuid) from public,anon;
grant execute on function public.renqd_pokemon_name_em_all_create_multiplayer(jsonb,text) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_invite_users(uuid,text[]) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_create_invite_link(uuid,text,timestamptz) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_join_by_token(text) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_respond_invite(uuid,boolean) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_set_ready(uuid,boolean) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_start_multiplayer(uuid) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_heartbeat(uuid) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_leave(uuid) to authenticated;
grant execute on function public.renqd_pokemon_name_em_all_expel(uuid,uuid) to authenticated;
