create or replace function public.renqd_invite_multiplayer_users(
  p_ranking_id uuid,
  p_usernames text[]
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.ranking_multiplayer_sessions%rowtype;
  v_actor_username text;
  v_invited jsonb := '[]'::jsonb;
  v_username text;
  v_target_id uuid;
  v_target_username text;
  v_participant_id uuid;
  v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  select * into v_session from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non disponibile per gli inviti' using errcode='42501'; end if;
  if coalesce(array_length(p_usernames,1),0)<1 then
    raise exception 'Inserisci almeno uno username' using errcode='22023';
  end if;
  select username into v_actor_username from public.profiles where id=v_user_id;
  for v_username in
    select distinct lower(btrim(input.username))
    from unnest(p_usernames) as input(username)
    where nullif(btrim(input.username),'') is not null
  loop
    v_target_id := null;
    v_target_username := null;
    select p.id,p.username into v_target_id,v_target_username
    from public.profiles p
    where lower(p.username)=v_username and p.status='APPROVED';
    if v_target_id is null then
      raise exception 'Utente @% non trovato o non approvato',v_username using errcode='P0002';
    end if;
    if v_target_id=v_user_id then
      raise exception 'Non puoi invitare te stesso' using errcode='22023';
    end if;
    if exists(select 1 from public.ranking_participants rp where rp.ranking_id=p_ranking_id and rp.user_id=v_target_id and rp.invitation_status in ('PENDING','ACCEPTED')) then
      continue;
    end if;
    select count(*) into v_count from public.ranking_participants
    where ranking_id=p_ranking_id and invitation_status in ('PENDING','ACCEPTED');
    if v_count>=v_session.max_participants then
      raise exception 'La sessione ha raggiunto il limite di % partecipanti',v_session.max_participants using errcode='22023';
    end if;
    insert into public.ranking_participants(ranking_id,user_id,participant_role,invitation_status,progress_status)
    values(p_ranking_id,v_target_id,'COLLABORATOR','PENDING','NOT_STARTED')
    on conflict (ranking_id,user_id) do update
      set invitation_status='PENDING',participant_role='COLLABORATOR',
          progress_status='NOT_STARTED',completed_at=null,left_at=null,joined_at=null
      where public.ranking_participants.invitation_status in ('DECLINED','REVOKED')
    returning id into v_participant_id;
    if v_participant_id is null then
      continue;
    end if;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    values(v_target_id,v_user_id,'RANKING_INVITE',jsonb_build_object(
      'participantId',v_participant_id,'rankingId',p_ranking_id,'sessionId',v_session.id,
      'rankingTitle',(select title from public.rankings where id=p_ranking_id),
      'actorUsername',coalesce(v_actor_username,'Un utente Renqd')
    ));
    v_invited := v_invited || jsonb_build_array(jsonb_build_object('username',v_target_username,'participantId',v_participant_id));
  end loop;
  return jsonb_build_object('invited',v_invited,'count',jsonb_array_length(v_invited));
end;
$$;

create or replace function public.renqd_create_multiplayer_ranking(
  p_payload jsonb,
  p_session_mode text,
  p_duration_minutes integer,
  p_max_participants integer default 8
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_created jsonb;
  v_ranking_id uuid;
  v_session_id uuid;
  v_payload jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_session_mode is null or p_session_mode not in ('COLLABORATIVE','COMPETITIVE') then
    raise exception 'Modalità multiplayer non valida' using errcode='22023';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 1440 then
    raise exception 'La durata deve essere compresa tra 1 e 1440 minuti' using errcode='22023';
  end if;
  if p_max_participants is null or p_max_participants not between 2 and 8 then
    raise exception 'Il numero di partecipanti deve essere compreso tra 2 e 8' using errcode='22023';
  end if;
  v_payload := p_payload || jsonb_build_object('participation_mode','COLLAB');
  v_payload := jsonb_set(
    v_payload,
    '{settings}',
    coalesce(v_payload->'settings','{}'::jsonb) ||
      jsonb_build_object('multiplayerMode',p_session_mode,'multiplayerDurationMinutes',p_duration_minutes,'multiplayerMaxParticipants',p_max_participants),
    true
  );
  v_created := public.renqd_create_ranking_with_items(v_payload);
  v_ranking_id := (v_created->>'id')::uuid;
  insert into public.ranking_multiplayer_sessions(ranking_id,creator_id,session_mode,duration_minutes,max_participants)
  values(v_ranking_id,v_user_id,p_session_mode,p_duration_minutes,p_max_participants)
  returning id into v_session_id;
  insert into public.ranking_participants(
    ranking_id,user_id,participant_role,invitation_status,joined_at,progress_status,last_activity_at
  ) values (
    v_ranking_id,v_user_id,'CREATOR','ACCEPTED',now(),'NOT_STARTED',now()
  );
  return v_created || jsonb_build_object('sessionId',v_session_id,'sessionMode',p_session_mode);
end;
$$;

create or replace function public.renqd_create_multiplayer_invite_link(
  p_ranking_id uuid,
  p_token_hash text,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_link_id uuid;
begin
  if v_user_id is null or not private.is_approved_user() then
    raise exception 'Account non autorizzato' using errcode='42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token invito non valido' using errcode='22023';
  end if;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception 'La scadenza del link deve essere futura' using errcode='22023';
  end if;
  select id into v_session_id from public.ranking_multiplayer_sessions
  where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY'
  for update;
  if not found then raise exception 'Sessione non disponibile' using errcode='42501'; end if;
  update public.ranking_invite_links set revoked_at=now()
  where session_id=v_session_id and revoked_at is null;
  insert into public.ranking_invite_links(session_id,token_hash,created_by,expires_at)
  values(v_session_id,p_token_hash,v_user_id,p_expires_at)
  returning id into v_link_id;
  return v_link_id;
end;
$$;
