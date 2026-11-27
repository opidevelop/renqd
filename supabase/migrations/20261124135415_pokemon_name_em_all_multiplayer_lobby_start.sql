create or replace function public.renqd_pokemon_name_em_all_set_ready(p_session_id uuid,p_ready boolean)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare v_user_id uuid:=auth.uid();v_session public.pokemon_name_em_all_sessions%rowtype;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status<>'LOBBY' then raise exception 'La lobby non è più disponibile' using errcode='22023'; end if;
  update public.pokemon_name_em_all_participants set is_ready=p_ready,last_seen_at=now(),is_connected=true
   where session_id=p_session_id and user_id=v_user_id and is_active and expelled_at is null;
  if not found then raise exception 'Non fai parte della lobby' using errcode='42501'; end if;
  return jsonb_build_object('ready',p_ready,'sessionId',p_session_id);
end;
$$;

create or replace function public.renqd_pokemon_name_em_all_start_multiplayer(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_session public.pokemon_name_em_all_sessions%rowtype;
  v_count integer;
  v_ready integer;
  v_start timestamptz:=now()+interval '3 seconds';
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.pokemon_name_em_all_sessions where id=p_session_id for update;
  if not found or v_session.status<>'LOBBY' or v_session.host_id<>v_user_id then raise exception 'Solo l’host può avviare la partita' using errcode='42501'; end if;
  select count(*),count(*) filter(where is_ready) into v_count,v_ready
   from public.pokemon_name_em_all_participants
   where session_id=p_session_id and is_active and expelled_at is null;
  if v_count<2 then raise exception 'Servono almeno due partecipanti' using errcode='22023'; end if;
  if v_count<>v_ready then raise exception 'Tutti i partecipanti devono essere pronti' using errcode='22023'; end if;
  update public.pokemon_name_em_all_sessions
   set status='ACTIVE',started_at=v_start,deadline_at=v_start+make_interval(secs=>duration_seconds),
       remaining_seconds=duration_seconds,paused_at=null,updated_at=now()
   where id=p_session_id;
  update public.rankings r set started_at=v_start
   from public.pokemon_name_em_all_participants p
   where p.session_id=p_session_id and p.ranking_id=r.id;
  return jsonb_build_object('status','ACTIVE','startedAt',v_start,'deadlineAt',v_start+make_interval(secs=>v_session.duration_seconds));
end;
$$;

