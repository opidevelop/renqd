CREATE OR REPLACE FUNCTION public.renqd_invite_multiplayer_users(p_ranking_id uuid, p_usernames text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_actor_username text;
  v_invited jsonb:='[]'::jsonb;v_username text;v_target_id uuid;v_target_username text;v_participant_id uuid;v_count integer;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id and creator_id=v_user_id and status='LOBBY' for update;
  if not found then raise exception 'Sessione non disponibile per gli inviti' using errcode='42501'; end if;
  if coalesce(array_length(p_usernames,1),0)<1 then raise exception 'Inserisci almeno uno username' using errcode='22023'; end if;
  select username into v_actor_username from public.profiles where id=v_user_id;
  for v_username in
    select distinct lower(btrim(input.username)) from unnest(p_usernames) as input(username)
    where nullif(btrim(input.username),'') is not null
  loop
    v_target_id:=null;v_target_username:=null;
    select p.id,p.username into v_target_id,v_target_username from public.profiles p
    where lower(p.username)=v_username and p.status='APPROVED';
    if v_target_id is null then raise exception 'Utente @% non trovato o non approvato',v_username using errcode='P0002'; end if;
    if v_target_id=v_user_id then raise exception 'Non puoi invitare te stesso' using errcode='22023'; end if;
    if exists(select 1 from public.ranking_participants rp where rp.ranking_id=p_ranking_id and rp.user_id=v_target_id and rp.invitation_status in ('PENDING','ACCEPTED')) then continue; end if;
    select count(*) into v_count from public.ranking_participants where ranking_id=p_ranking_id and invitation_status in ('PENDING','ACCEPTED');
    if v_count>=v_session.max_participants then raise exception 'La sessione ha raggiunto il limite di % partecipanti',v_session.max_participants using errcode='22023'; end if;
    insert into public.ranking_participants(ranking_id,user_id,participant_role,invitation_status,progress_status)
    values(p_ranking_id,v_target_id,'COLLABORATOR','PENDING','NOT_STARTED')
    on conflict(ranking_id,user_id) do update
      set invitation_status='PENDING',participant_role='COLLABORATOR',progress_status='NOT_STARTED',
        completed_at=null,left_at=null,joined_at=null
      where public.ranking_participants.invitation_status in ('DECLINED','REVOKED')
    returning id into v_participant_id;
    if v_participant_id is null then continue; end if;
    insert into public.user_notifications(recipient_id,actor_id,notification_type,payload)
    values(v_target_id,v_user_id,'RANKING_INVITE',jsonb_build_object(
      'participantId',v_participant_id,'rankingId',p_ranking_id,'sessionId',v_session.id,
      'rankingTitle',(select title from public.rankings where id=p_ranking_id),
      'sessionMode',v_session.session_mode,'durationMinutes',v_session.duration_minutes,
      'actorUsername',coalesce(v_actor_username,'Un utente Renqd')
    ));
    v_invited:=v_invited||jsonb_build_array(jsonb_build_object('username',v_target_username,'participantId',v_participant_id));
  end loop;
  return jsonb_build_object('invited',v_invited,'count',jsonb_array_length(v_invited));
end;
$function$;
revoke all on function public.renqd_invite_multiplayer_users(uuid,text[]) from public,anon;
grant execute on function public.renqd_invite_multiplayer_users(uuid,text[]) to authenticated;
