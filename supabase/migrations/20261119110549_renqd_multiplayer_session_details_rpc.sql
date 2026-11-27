CREATE OR REPLACE FUNCTION public.renqd_get_multiplayer_session(p_ranking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_user_id uuid:=auth.uid();v_session public.ranking_multiplayer_sessions%rowtype;v_ranking public.rankings%rowtype;v_participants jsonb;v_link jsonb;
begin
  if v_user_id is null or not private.is_approved_user() then raise exception 'Account non autorizzato' using errcode='42501'; end if;
  select * into v_session from public.ranking_multiplayer_sessions where ranking_id=p_ranking_id;
  if not found then raise exception 'Sessione non trovata' using errcode='P0002'; end if;
  if v_session.creator_id<>v_user_id and not private.is_ranking_multiplayer_member(p_ranking_id) then raise exception 'Non fai parte di questa sessione' using errcode='42501'; end if;
  select * into v_ranking from public.rankings where id=p_ranking_id and hidden_at is null and deleted_at is null;
  if not found then raise exception 'Classifica non disponibile' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rp.id,'userId',rp.user_id,'username',coalesce(pp.username,p.username,'utente'),
    'displayName',coalesce(nullif(pp.display_name,''),p.username,'Partecipante'),'avatarUrl',pp.avatar_url,
    'role',rp.participant_role,'invitationStatus',rp.invitation_status,'progressStatus',rp.progress_status,
    'joinedAt',rp.joined_at,'completedAt',rp.completed_at,'isCurrentUser',rp.user_id=v_user_id
  ) order by case when rp.participant_role='CREATOR' then 0 else 1 end,rp.created_at),'[]'::jsonb)
  into v_participants
  from public.ranking_participants rp left join public.profiles p on p.id=rp.user_id
  left join public.public_profiles pp on pp.user_id=rp.user_id where rp.ranking_id=p_ranking_id;
  if v_session.creator_id=v_user_id then
    select jsonb_build_object('id',il.id,'expiresAt',il.expires_at,'createdAt',il.created_at)
    into v_link from public.ranking_invite_links il where il.session_id=v_session.id and il.revoked_at is null
      and (il.expires_at is null or il.expires_at>now()) order by il.created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'session',jsonb_build_object('id',v_session.id,'rankingId',v_session.ranking_id,'creatorId',v_session.creator_id,
      'mode',v_session.session_mode,'status',v_session.status,'durationMinutes',v_session.duration_minutes,
      'maxParticipants',v_session.max_participants,'startedAt',v_session.started_at,'deadlineAt',v_session.deadline_at,
      'extensionCount',v_session.extension_count,'revealedAt',v_session.revealed_at,
      'sharedState',case when v_session.session_mode='COLLABORATIVE' then v_session.shared_state else null end),
    'ranking',jsonb_build_object('id',v_ranking.id,'title',v_ranking.title,'mode',v_ranking.mode,
      'visibility',v_ranking.visibility,'allowTies',v_ranking.allow_ties,'settings',v_ranking.settings,'publicSlug',v_ranking.public_slug),
    'participants',v_participants,'inviteLink',v_link,'isCreator',v_session.creator_id=v_user_id,'currentUserId',v_user_id
  );
end;
$function$;
revoke all on function public.renqd_get_multiplayer_session(uuid) from public,anon;
grant execute on function public.renqd_get_multiplayer_session(uuid) to authenticated;
